import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class UserService implements OnModuleInit {
    private readonly logger = new Logger(UserService.name);

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private configService: ConfigService,
    ) { }

    /**
     * Uygulama açılışında .env ile tanımlanan admin hesabını hazırlar.
     */
    async onModuleInit(): Promise<void> {
        await this.ensureSeedAdminFromEnv();
    }

    /**
     * ADMIN_SEED_EMAIL ve ADMIN_SEED_PASSWORD varsa admin kullanıcısını oluşturur veya günceller.
     */
    private async ensureSeedAdminFromEnv(): Promise<void> {
        const email = this.configService.get<string>('ADMIN_SEED_EMAIL')?.trim();
        const password = this.configService.get<string>('ADMIN_SEED_PASSWORD');

        if (!email || !password) {
            return;
        }

        if (password.length < 6) {
            this.logger.warn('ADMIN_SEED_PASSWORD en az 6 karakter olmalı; admin seed atlandı.');
            return;
        }

        const firstname = this.configService.get<string>('ADMIN_SEED_FIRSTNAME')?.trim() || 'Yönetici';
        const lastname = this.configService.get<string>('ADMIN_SEED_LASTNAME')?.trim() || 'Admin';
        const passwordHash = await bcrypt.hash(password, 10);
        const existingUser = await this.userRepository.findOne({ where: { email } });

        if (existingUser) {
            existingUser.firstname = firstname;
            existingUser.lastname = lastname;
            existingUser.password = passwordHash;
            existingUser.roles = Array.from(new Set([...(existingUser.roles || []), Role.ADMIN]));
            await this.userRepository.save(existingUser);
            this.logger.log(`Env admin kullanıcısı güncellendi: ${email}`);
            return;
        }

        const admin = this.userRepository.create({
            firstname,
            lastname,
            email,
            password: passwordHash,
            phone: null,
            roles: [Role.ADMIN],
        });
        await this.userRepository.save(admin);
        this.logger.log(`Env admin kullanıcısı oluşturuldu: ${email}`);
    }

    async create(createUserDto: CreateUserDto): Promise<User> {
        // Email kontrolü
        const existingUserByEmail = await this.userRepository.findOne({
            where: { email: createUserDto.email },
        });

        if (existingUserByEmail) {
            throw new ConflictException('Bu email adresi zaten kullanılıyor');
        }

        // Telefon kontrolü (sadece phone null değilse)
        if (createUserDto.phone) {
            const phoneValue: string = createUserDto.phone;
            const existingUserByPhone = await this.userRepository.findOne({
                where: { phone: phoneValue },
            });

            if (existingUserByPhone) {
                throw new ConflictException('Bu telefon numarası zaten kullanılıyor');
            }
        }

        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

        const user = this.userRepository.create({
            firstname: createUserDto.firstname,
            lastname: createUserDto.lastname,
            email: createUserDto.email,
            password: hashedPassword,
            phone: createUserDto.phone || null,
            roles: [Role.USER], // Default rol
        });

        return await this.userRepository.save(user);
    }

    async findAll(): Promise<User[]> {
        return await this.userRepository.find({
            select: ['id', 'firstname', 'lastname', 'email', 'phone', 'roles', 'createdAt', 'updatedAt'],
        });
    }

    async findAllCustomers(): Promise<User[]> {
        // Sadece USER rolüne sahip kullanıcıları getir (ADMIN değil)
        const allUsers = await this.userRepository.find({
            select: ['id', 'firstname', 'lastname', 'email', 'phone', 'roles', 'createdAt', 'updatedAt'],
        });

        // ADMIN rolüne sahip olmayan kullanıcıları filtrele
        return allUsers.filter(user =>
            !user.roles || !user.roles.includes(Role.ADMIN)
        );
    }

    async findOne(id: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id },
            select: ['id', 'firstname', 'lastname', 'email', 'phone', 'roles', 'createdAt', 'updatedAt'],
        });

        if (!user) {
            throw new NotFoundException('Kullanıcı bulunamadı');
        }

        return user;
    }

    async findByEmail(email: string): Promise<User | null> {
        return await this.userRepository.findOne({
            where: { email },
        });
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user = await this.findOne(id);

        // Email kontrolü
        if (updateUserDto.email && updateUserDto.email !== user.email) {
            const existingUser = await this.userRepository.findOne({
                where: { email: updateUserDto.email },
            });

            if (existingUser) {
                throw new ConflictException('Bu email adresi zaten kullanılıyor');
            }
        }

        // Telefon kontrolü
        if (updateUserDto.phone && updateUserDto.phone !== user.phone) {
            const existingUser = await this.userRepository.findOne({
                where: { phone: updateUserDto.phone },
            });

            if (existingUser) {
                throw new ConflictException('Bu telefon numarası zaten kullanılıyor');
            }
        }

        if (updateUserDto.password) {
            updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
        }

        Object.assign(user, updateUserDto);
        return await this.userRepository.save(user);
    }

    async remove(id: string): Promise<void> {
        const user = await this.findOne(id);
        await this.userRepository.remove(user);
    }

    /**
     * Kullanıcıya rol ekler
     */
    async addRole(userId: string, role: Role): Promise<User> {
        const user = await this.findOne(userId);

        if (!user.roles) {
            user.roles = [];
        }

        if (user.roles.includes(role)) {
            throw new BadRequestException('Kullanıcı zaten bu role sahip');
        }

        user.roles.push(role);
        return await this.userRepository.save(user);
    }

    /**
     * Kullanıcıdan rol kaldırır
     */
    async removeRole(userId: string, role: Role): Promise<User> {
        const user = await this.findOne(userId);

        if (!user.roles || !user.roles.includes(role)) {
            throw new BadRequestException('Kullanıcı bu role sahip değil');
        }

        user.roles = user.roles.filter((r) => r !== role);

        // En az bir rol olmalı
        if (user.roles.length === 0) {
            user.roles = [Role.USER];
        }

        return await this.userRepository.save(user);
    }

    /**
     * Kullanıcının rollerini set eder
     */
    async setRoles(userId: string, roles: Role[]): Promise<User> {
        const user = await this.findOne(userId);

        if (!roles || roles.length === 0) {
            throw new BadRequestException('En az bir rol gerekli');
        }

        // Duplicate kontrolü
        const uniqueRoles = [...new Set(roles)];
        user.roles = uniqueRoles;

        return await this.userRepository.save(user);
    }

    /**
     * Tüm admin kullanıcılarını getirir
     */
    async findAllAdmins(): Promise<User[]> {
        return await this.userRepository.find({
            where: {},
            select: ['id', 'firstname', 'lastname', 'email', 'phone', 'roles', 'createdAt', 'updatedAt'],
        }).then(users =>
            users.filter(user => user.roles && user.roles.includes(Role.ADMIN))
        );
    }

    /**
     * Yeni admin kullanıcısı oluşturur
     */
    async createAdmin(createUserDto: CreateUserDto): Promise<User> {
        // Email kontrolü
        const existingUserByEmail = await this.userRepository.findOne({
            where: { email: createUserDto.email },
        });

        if (existingUserByEmail) {
            throw new ConflictException('Bu email adresi zaten kullanılıyor');
        }

        // Telefon kontrolü (sadece phone null değilse)
        if (createUserDto.phone) {
            const phoneValue: string = createUserDto.phone;
            const existingUserByPhone = await this.userRepository.findOne({
                where: { phone: phoneValue },
            });

            if (existingUserByPhone) {
                throw new ConflictException('Bu telefon numarası zaten kullanılıyor');
            }
        }

        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

        const user = this.userRepository.create({
            firstname: createUserDto.firstname,
            lastname: createUserDto.lastname,
            email: createUserDto.email,
            password: hashedPassword,
            phone: createUserDto.phone || null,
            roles: [Role.ADMIN], // Admin rolü ile oluştur
        });

        return await this.userRepository.save(user);
    }

    /**
     * Admin kullanıcısını günceller
     */
    async updateAdmin(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user = await this.findOne(id);

        // Admin kontrolü
        if (!user.roles || !user.roles.includes(Role.ADMIN)) {
            throw new BadRequestException('Bu kullanıcı admin değil');
        }

        // Email kontrolü
        if (updateUserDto.email && updateUserDto.email !== user.email) {
            const existingUser = await this.userRepository.findOne({
                where: { email: updateUserDto.email },
            });

            if (existingUser) {
                throw new ConflictException('Bu email adresi zaten kullanılıyor');
            }
        }

        // Telefon kontrolü
        if (updateUserDto.phone && updateUserDto.phone !== user.phone) {
            const existingUser = await this.userRepository.findOne({
                where: { phone: updateUserDto.phone },
            });

            if (existingUser) {
                throw new ConflictException('Bu telefon numarası zaten kullanılıyor');
            }
        }

        if (updateUserDto.password) {
            updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
        }

        Object.assign(user, updateUserDto);
        // Admin rolünü koru
        if (!user.roles.includes(Role.ADMIN)) {
            user.roles.push(Role.ADMIN);
        }
        return await this.userRepository.save(user);
    }

    /**
     * Admin kullanıcısını siler
     */
    async removeAdmin(id: string): Promise<void> {
        const user = await this.findOne(id);

        // Admin kontrolü
        if (!user.roles || !user.roles.includes(Role.ADMIN)) {
            throw new BadRequestException('Bu kullanıcı admin değil');
        }

        await this.userRepository.remove(user);
    }
}
