import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { AnalyticsEvent } from './analytics-event.entity';
import { ProductAnalyticsDaily } from './product-analytics-daily.entity';
import { ProductAnalyticsTotal } from './product-analytics-total.entity';
import { StoreAnalyticsDaily } from './store-analytics-daily.entity';
import { StoreAnalyticsTotal } from './store-analytics-total.entity';
import { Order } from '../order/order.entity';
import { OrderItem } from '../order/order-item.entity';
import { Product } from '../product/product.entity';
import { AnalyticsEventType } from '../common/enums/analytics-event-type.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { IngestEventsDto } from './dto/ingest-events.dto';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        @InjectRepository(AnalyticsEvent)
        private readonly eventRepository: Repository<AnalyticsEvent>,
        @InjectRepository(ProductAnalyticsDaily)
        private readonly productDailyRepository: Repository<ProductAnalyticsDaily>,
        @InjectRepository(ProductAnalyticsTotal)
        private readonly productTotalRepository: Repository<ProductAnalyticsTotal>,
        @InjectRepository(StoreAnalyticsDaily)
        private readonly storeDailyRepository: Repository<StoreAnalyticsDaily>,
        @InjectRepository(StoreAnalyticsTotal)
        private readonly storeTotalRepository: Repository<StoreAnalyticsTotal>,
        @InjectRepository(Order)
        private readonly orderRepository: Repository<Order>,
        @InjectRepository(OrderItem)
        private readonly orderItemRepository: Repository<OrderItem>,
        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,
    ) { }

    /**
     * Ingest events from store frontend. Fire-and-forget: response is sent before DB insert.
     */
    ingestEvents(dto: IngestEventsDto, userId?: string | null): void {
        const rawCount = dto?.events?.length ?? 0;
        this.logger.log(`[Analytics] ingestEvents: raw events=${rawCount}`);

        const entities: AnalyticsEvent[] = [];
        for (const e of dto.events) {
            if (!this.validateEvent(e)) {
                this.logger.log(`[Analytics] event skipped (validation): type=${e.type} productId=${e.productId ?? 'n/a'} page=${(e as any).page ?? 'n/a'}`);
                continue;
            }
            const entity = this.eventRepository.create({
                eventType: e.type,
                productId: e.productId ?? null,
                variantId: e.variantId ?? null,
                userId: e.userId ?? userId ?? null,
                sessionId: e.sessionId ?? null,
                payload: this.buildPayload(e),
            });
            entities.push(entity);
        }

        if (entities.length === 0) {
            this.logger.log(`[Analytics] ingestEvents: no valid events to save (validated=0)`);
            return;
        }

        this.logger.log(`[Analytics] ingestEvents: saving ${entities.length} events (types: ${[...new Set(entities.map((x) => x.eventType))].join(', ')})`);
        this.eventRepository.save(entities)
            .then((saved) => {
                this.logger.log(`[Analytics] ingestEvents: saved ${saved?.length ?? entities.length} events successfully`);
            })
            .catch((err) => {
                this.logger.error(`[Analytics] ingest failed: ${err?.message}`, err?.stack);
            });
    }

    private validateEvent(e: IngestEventsDto['events'][0]): boolean {
        if (e.type === AnalyticsEventType.PRODUCT_VIEW || e.type === AnalyticsEventType.CART_ADD) {
            return !!e.productId;
        }
        if (e.type === AnalyticsEventType.PRODUCT_TIME) {
            return !!e.productId && typeof e.durationSeconds === 'number' && e.durationSeconds >= 0;
        }
        if (e.type === AnalyticsEventType.PAGE_VIEW) {
            return !!e.page;
        }
        return true;
    }

    private buildPayload(e: IngestEventsDto['events'][0]): Record<string, unknown> {
        const payload: Record<string, unknown> = {};
        if (e.durationSeconds != null) payload.durationSeconds = e.durationSeconds;
        if (e.page != null) payload.page = e.page;
        if (e.quantity != null) payload.quantity = e.quantity;
        if (e.orderId != null) payload.orderId = e.orderId;
        return Object.keys(payload).length ? payload : {};
    }

    /** Sunucu yerel tarihine göre YYYY-MM-DD (toISOString UTC'ye çevirdiği için yanlış tarih veriyordu). */
    private toLocalDateStr(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /**
     * Cron: every day at 00:00, aggregate previous day's events only.
     */
    @Cron('0 0 * * *')
    async runDailyAggregation(): Promise<void> {
        await this.runDailyAggregationInternal(false);
    }

    /**
     * Manuel tetikleme (panel butonu): dün + bugün (şu ana kadar) agregasyonu yapar.
     * @param includeToday true ise bugünün event'leri de işlenir (butondan çağrıda true)
     */
    async runDailyAggregationManual(includeToday = true): Promise<void> {
        await this.runDailyAggregationInternal(includeToday);
    }

    private async runDailyAggregationInternal(includeToday: boolean): Promise<void> {
        const now = new Date();
        const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(localMidnight);
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayStr = this.toLocalDateStr(yesterday);
        const todayStr = this.toLocalDateStr(localMidnight);

        this.logger.log(
            `[runDailyAggregation] serverNow=${now.toISOString()} localDate=${todayStr} yesterday=${yesterdayStr} includeToday=${includeToday}`,
        );

        try {
            await this.aggregateForDate(yesterdayStr, {
                startOfDay: new Date(yesterday.getTime()),
                endOfDay: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1),
            });

            if (includeToday) {
                this.logger.log(`[runDailyAggregation] aggregating today (so far): ${todayStr}`);
                await this.aggregateForDate(todayStr, {
                    startOfDay: new Date(localMidnight.getTime()),
                    endOfDay: now,
                });
            }

            this.logger.log(`[runDailyAggregation] Completed. Processed: ${yesterdayStr}${includeToday ? `, ${todayStr}` : ''}`);
        } catch (err: any) {
            this.logger.error(`[runDailyAggregation] Failed: ${err?.message}`, err?.stack);
            throw err;
        }
    }

    private async aggregateForDate(
        dateStr: string,
        range: { startOfDay: Date; endOfDay: Date },
    ): Promise<void> {
        const { startOfDay, endOfDay } = range;

        this.logger.log(`[aggregateForDate] date=${dateStr} range=${startOfDay.toISOString()} .. ${endOfDay.toISOString()}`);

        const events = await this.eventRepository.find({
            where: { createdAt: Between(startOfDay, endOfDay) },
            order: { createdAt: 'ASC' },
        });

        this.logger.log(`[aggregateForDate] date=${dateStr} events found=${events.length} (types: ${[...new Set(events.map((e) => e.eventType))].join(', ') || 'none'})`);

        const productViewCounts: Record<string, { views: number; time: number; cartAdds: number }> = {};
        let pageViewCount = 0;
        let productViewTotal = 0;
        let cartAddTotal = 0;
        const pageBreakdown: Record<string, number> = {};

        for (const ev of events) {
            if (ev.eventType === AnalyticsEventType.PRODUCT_VIEW && ev.productId) {
                if (!productViewCounts[ev.productId]) productViewCounts[ev.productId] = { views: 0, time: 0, cartAdds: 0 };
                productViewCounts[ev.productId].views += 1;
                productViewTotal += 1;
            } else if (ev.eventType === AnalyticsEventType.PRODUCT_TIME && ev.productId) {
                if (!productViewCounts[ev.productId]) productViewCounts[ev.productId] = { views: 0, time: 0, cartAdds: 0 };
                const sec = (ev.payload as any)?.durationSeconds ?? 0;
                productViewCounts[ev.productId].time += Number(sec);
            } else if (ev.eventType === AnalyticsEventType.CART_ADD && ev.productId) {
                if (!productViewCounts[ev.productId]) productViewCounts[ev.productId] = { views: 0, time: 0, cartAdds: 0 };
                productViewCounts[ev.productId].cartAdds += 1;
                cartAddTotal += 1;
            } else if (ev.eventType === AnalyticsEventType.PAGE_VIEW) {
                pageViewCount += 1;
                const page = (ev.payload as any)?.page ?? 'unknown';
                pageBreakdown[page] = (pageBreakdown[page] ?? 0) + 1;
            }
        }

        const productOrderCounts: Record<string, number> = {};
        const orderItemCounts = await this.orderItemRepository
            .createQueryBuilder('oi')
            .innerJoin('oi.order', 'o')
            .select('oi.productId', 'productId')
            .addSelect('SUM(oi.quantity)', 'total')
            .where('o.createdAt >= :start', { start: startOfDay })
            .andWhere('o.createdAt <= :end', { end: endOfDay })
            .andWhere('o.status IN (:...statuses)', {
                statuses: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
            })
            .groupBy('oi.productId')
            .getRawMany<{ productId: string; total: string }>();
        for (const row of orderItemCounts) {
            productOrderCounts[row.productId] = parseInt(row.total, 10) || 0;
        }

        const existingProductDaily = await this.productDailyRepository.find({ where: { date: dateStr } });
        const oldProductByKey: Record<string, { viewCount: number; totalTimeSeconds: number; cartAddCount: number; orderCount: number }> = {};
        for (const row of existingProductDaily) {
            oldProductByKey[row.productId] = {
                viewCount: row.viewCount,
                totalTimeSeconds: row.totalTimeSeconds,
                cartAddCount: row.cartAddCount,
                orderCount: row.orderCount,
            };
        }

        for (const [productId, counts] of Object.entries(productViewCounts)) {
            const orderCount = productOrderCounts[productId] ?? 0;
            await this.productDailyRepository.upsert(
                {
                    productId,
                    date: dateStr,
                    viewCount: counts.views,
                    totalTimeSeconds: counts.time,
                    cartAddCount: counts.cartAdds,
                    orderCount,
                },
                { conflictPaths: ['productId', 'date'], skipUpdateIfNoValuesChanged: false },
            );
        }
        for (const productId of Object.keys(productOrderCounts)) {
            if (productViewCounts[productId]) continue;
            await this.productDailyRepository.upsert(
                {
                    productId,
                    date: dateStr,
                    viewCount: 0,
                    totalTimeSeconds: 0,
                    cartAddCount: 0,
                    orderCount: productOrderCounts[productId],
                },
                { conflictPaths: ['productId', 'date'], skipUpdateIfNoValuesChanged: false },
            );
        }

        const orderStats = await this.orderRepository
            .createQueryBuilder('o')
            .select('COUNT(o.id)', 'count')
            .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
            .where('o.createdAt >= :start', { start: startOfDay })
            .andWhere('o.createdAt <= :end', { end: endOfDay })
            .andWhere('o.status IN (:...statuses)', {
                statuses: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
            })
            .getRawOne<{ count: string; revenue: string }>();

        const orderCount = parseInt(orderStats?.count ?? '0', 10);
        const totalRevenue = parseFloat(orderStats?.revenue ?? '0') || 0;

        const existingStoreDaily = await this.storeDailyRepository.findOne({ where: { date: dateStr } });
        const oldStoreDaily = existingStoreDaily
            ? {
                pageViewCount: existingStoreDaily.pageViewCount,
                productViewCount: existingStoreDaily.productViewCount,
                cartAddCount: existingStoreDaily.cartAddCount,
                orderCount: existingStoreDaily.orderCount,
                totalRevenue: Number(existingStoreDaily.totalRevenue),
            }
            : null;

        await this.storeDailyRepository.upsert(
            {
                date: dateStr,
                pageViewCount,
                productViewCount: productViewTotal,
                cartAddCount: cartAddTotal,
                orderCount,
                totalRevenue,
                pageBreakdown: Object.keys(pageBreakdown).length ? pageBreakdown : null,
            },
            { conflictPaths: ['date'], skipUpdateIfNoValuesChanged: false },
        );

        this.logger.log(
            `[aggregateForDate] date=${dateStr} daily: pageViews=${pageViewCount} productViews=${productViewTotal} cartAdds=${cartAddTotal} orders=${orderCount} revenue=${totalRevenue} products=${Object.keys(productViewCounts).length}`,
        );

        await this.updateProductTotalsWithDelta(dateStr, oldProductByKey);
        await this.updateStoreTotalsWithDelta(
            oldStoreDaily,
            { pageViewCount, productViewCount: productViewTotal, cartAddCount: cartAddTotal, orderCount, totalRevenue },
        );
    }

    private async updateProductTotalsWithDelta(
        dateStr: string,
        oldByProduct: Record<string, { viewCount: number; totalTimeSeconds: number; cartAddCount: number; orderCount: number }>,
    ): Promise<void> {
        const dailyRows = await this.productDailyRepository.find({ where: { date: dateStr } });
        for (const row of dailyRows) {
            const oldRow = oldByProduct[row.productId] ?? { viewCount: 0, totalTimeSeconds: 0, cartAddCount: 0, orderCount: 0 };
            const deltaView = row.viewCount - oldRow.viewCount;
            const deltaTime = row.totalTimeSeconds - oldRow.totalTimeSeconds;
            const deltaCart = row.cartAddCount - oldRow.cartAddCount;
            const deltaOrder = row.orderCount - oldRow.orderCount;
            if (deltaView === 0 && deltaTime === 0 && deltaCart === 0 && deltaOrder === 0) continue;

            const existing = await this.productTotalRepository.findOne({ where: { productId: row.productId } });
            if (existing) {
                existing.viewCount += deltaView;
                existing.totalTimeSeconds += deltaTime;
                existing.cartAddCount += deltaCart;
                existing.orderCount += deltaOrder;
                await this.productTotalRepository.save(existing);
            } else {
                await this.productTotalRepository.save({
                    productId: row.productId,
                    viewCount: row.viewCount,
                    totalTimeSeconds: row.totalTimeSeconds,
                    cartAddCount: row.cartAddCount,
                    orderCount: row.orderCount,
                });
            }
        }
        this.logger.log(`[updateProductTotalsWithDelta] date=${dateStr} updated ${dailyRows.length} product totals`);
    }

    private async updateStoreTotalsWithDelta(
        oldDaily: { pageViewCount: number; productViewCount: number; cartAddCount: number; orderCount: number; totalRevenue: number } | null,
        newDaily: { pageViewCount: number; productViewCount: number; cartAddCount: number; orderCount: number; totalRevenue: number },
    ): Promise<void> {
        const delta = {
            pageViewCount: newDaily.pageViewCount - (oldDaily?.pageViewCount ?? 0),
            productViewCount: newDaily.productViewCount - (oldDaily?.productViewCount ?? 0),
            cartAddCount: newDaily.cartAddCount - (oldDaily?.cartAddCount ?? 0),
            orderCount: newDaily.orderCount - (oldDaily?.orderCount ?? 0),
            totalRevenue: newDaily.totalRevenue - (oldDaily?.totalRevenue ?? 0),
        };
        let store = await this.storeTotalRepository.findOne({ where: { id: 'default' } });
        if (!store) {
            store = this.storeTotalRepository.create({
                id: 'default',
                totalPageViews: newDaily.pageViewCount,
                totalProductViews: newDaily.productViewCount,
                totalCartAdds: newDaily.cartAddCount,
                totalOrders: newDaily.orderCount,
                totalRevenue: newDaily.totalRevenue,
                lastAggregationAt: new Date(),
            });
        } else {
            store.totalPageViews += delta.pageViewCount;
            store.totalProductViews += delta.productViewCount;
            store.totalCartAdds += delta.cartAddCount;
            store.totalOrders += delta.orderCount;
            store.totalRevenue = Number(store.totalRevenue) + delta.totalRevenue as any;
            store.lastAggregationAt = new Date();
        }
        await this.storeTotalRepository.save(store);
        this.logger.log(`[updateStoreTotalsWithDelta] applied delta pageViews=${delta.pageViewCount} productViews=${delta.productViewCount} cartAdds=${delta.cartAddCount} orders=${delta.orderCount}`);
    }

    async getProductReport(productId: string): Promise<{
        product: { id: string; name: string; slug: string; detailLink: string } | null;
        total: { viewCount: number; totalTimeSeconds: number; cartAddCount: number; orderCount: number };
        daily: Array<{ date: string; viewCount: number; totalTimeSeconds: number; cartAddCount: number; orderCount: number }>;
    }> {
        const product = await this.productRepository.findOne({
            where: { id: productId },
            select: { id: true, name: true, slug: true },
        });
        const total = await this.productTotalRepository.findOne({ where: { productId } });
        const from = new Date();
        from.setDate(from.getDate() - 30);
        const daily = await this.productDailyRepository.find({
            where: { productId, date: Between(from.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)) },
            order: { date: 'DESC' },
        });
        return {
            product: product
                ? {
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    detailLink: `/panel/analytics/products/${product.id}`,
                }
                : null,
            total: total
                ? {
                    viewCount: total.viewCount,
                    totalTimeSeconds: total.totalTimeSeconds,
                    cartAddCount: total.cartAddCount,
                    orderCount: total.orderCount,
                }
                : { viewCount: 0, totalTimeSeconds: 0, cartAddCount: 0, orderCount: 0 },
            daily: daily.map((d) => ({
                date: d.date,
                viewCount: d.viewCount,
                totalTimeSeconds: d.totalTimeSeconds,
                cartAddCount: d.cartAddCount,
                orderCount: d.orderCount,
            })),
        };
    }

    async getProductsReport(fromDate: string, toDate: string, page = 1, limit = 20): Promise<{
        data: Array<{
            productId: string;
            productName: string;
            productSlug: string;
            detailLink: string;
            viewCount: number;
            totalTimeSeconds: number;
            cartAddCount: number;
            orderCount: number;
        }>;
        total: number;
    }> {
        const countResult = await this.productDailyRepository
            .createQueryBuilder('d')
            .select('COUNT(DISTINCT d.productId)', 'cnt')
            .where('d.date >= :from', { from: fromDate })
            .andWhere('d.date <= :to', { to: toDate })
            .getRawOne<{ cnt: string }>();
        const totalCount = parseInt(countResult?.cnt ?? '0', 10);

        const raw = await this.productDailyRepository
            .createQueryBuilder('d')
            .select('d.productId', 'productId')
            .addSelect('SUM(d.viewCount)', 'viewCount')
            .addSelect('SUM(d.totalTimeSeconds)', 'totalTimeSeconds')
            .addSelect('SUM(d.cartAddCount)', 'cartAddCount')
            .addSelect('SUM(d.orderCount)', 'orderCount')
            .where('d.date >= :from', { from: fromDate })
            .andWhere('d.date <= :to', { to: toDate })
            .groupBy('d.productId')
            .orderBy('SUM(d.viewCount)', 'DESC')
            .offset((page - 1) * limit)
            .limit(limit)
            .getRawMany<{ productId: string; viewCount: string; totalTimeSeconds: string; cartAddCount: string; orderCount: string }>();

        const productIds = raw.map((r) => r.productId).filter(Boolean);
        const productMap: Record<string, { name: string; slug: string }> = {};
        if (productIds.length > 0) {
            const products = await this.productRepository.find({
                where: { id: In(productIds) },
                select: { id: true, name: true, slug: true },
            });
            for (const p of products) {
                productMap[p.id] = { name: p.name, slug: p.slug };
            }
        }

        const data = raw.map((r) => {
            const info = productMap[r.productId];
            return {
                productId: r.productId,
                productName: info?.name ?? '—',
                productSlug: info?.slug ?? '',
                detailLink: `/panel/analytics/products/${r.productId}`,
                viewCount: parseInt(r.viewCount, 10) || 0,
                totalTimeSeconds: parseInt(r.totalTimeSeconds, 10) || 0,
                cartAddCount: parseInt(r.cartAddCount, 10) || 0,
                orderCount: parseInt(r.orderCount, 10) || 0,
            };
        });
        return { data, total: totalCount };
    }

    async getStoreDaily(fromDate: string, toDate: string): Promise<StoreAnalyticsDaily[]> {
        return this.storeDailyRepository.find({
            where: { date: Between(fromDate, toDate) },
            order: { date: 'DESC' },
        });
    }

    async getStoreSummary(): Promise<StoreAnalyticsTotal | null> {
        return this.storeTotalRepository.findOne({ where: { id: 'default' } });
    }

    /**
     * Detaylı içgörüler (seçilen tarih aralığı): sepete ekleme oranı, sipariş oranı,
     * ortalama ürün sayfası süresi, sayfa kırılımı.
     */
    async getStoreInsights(fromDate: string, toDate: string): Promise<{
        cartAddRate: number;
        orderRate: number;
        avgTimeOnProductSeconds: number;
        pageBreakdown: Array<{ page: string; count: number }>;
    }> {
        const dailyRows = await this.storeDailyRepository.find({
            where: { date: Between(fromDate, toDate) },
        });
        let sumProductViews = 0;
        let sumCartAdds = 0;
        let sumOrders = 0;
        const pageBreakdownMap: Record<string, number> = {};
        for (const row of dailyRows) {
            sumProductViews += row.productViewCount ?? 0;
            sumCartAdds += row.cartAddCount ?? 0;
            sumOrders += row.orderCount ?? 0;
            if (row.pageBreakdown && typeof row.pageBreakdown === 'object') {
                for (const [page, count] of Object.entries(row.pageBreakdown)) {
                    pageBreakdownMap[page] = (pageBreakdownMap[page] ?? 0) + Number(count);
                }
            }
        }
        const cartAddRate = sumProductViews > 0 ? sumCartAdds / sumProductViews : 0;
        const orderRate = sumCartAdds > 0 ? sumOrders / sumCartAdds : 0;

        const timeSum = await this.productDailyRepository
            .createQueryBuilder('d')
            .select('COALESCE(SUM(d.totalTimeSeconds), 0)', 'sum')
            .addSelect('COALESCE(SUM(d.viewCount), 0)', 'views')
            .where('d.date >= :from', { from: fromDate })
            .andWhere('d.date <= :to', { to: toDate })
            .getRawOne<{ sum: string; views: string }>();
        const sumTime = parseInt(timeSum?.sum ?? '0', 10) || 0;
        const sumViews = parseInt(timeSum?.views ?? '0', 10) || 0;
        const avgTimeOnProductSeconds = sumViews > 0 ? sumTime / sumViews : 0;

        const pageBreakdown = Object.entries(pageBreakdownMap)
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => b.count - a.count);

        return { cartAddRate, orderRate, avgTimeOnProductSeconds, pageBreakdown };
    }

    async getEvents(filters: {
        productId?: string;
        type?: AnalyticsEventType;
        from?: string;
        to?: string;
        limit?: number;
    }): Promise<AnalyticsEvent[]> {
        const qb = this.eventRepository.createQueryBuilder('e');
        if (filters.productId) qb.andWhere('e.productId = :productId', { productId: filters.productId });
        if (filters.type) qb.andWhere('e.eventType = :type', { type: filters.type });
        if (filters.from) qb.andWhere('e.createdAt >= :from', { from: filters.from });
        if (filters.to) qb.andWhere('e.createdAt <= :to', { to: filters.to });
        qb.orderBy('e.createdAt', 'DESC');
        qb.take(Math.min(filters.limit ?? 100, 500));
        return qb.getMany();
    }
}
