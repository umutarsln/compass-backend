export enum OrderStatus {
  PENDING = 'PENDING', // Sipariş oluşturuldu, ödeme bekleniyor
  PAID = 'PAID', // Ödeme alındı
  PROCESSING = 'PROCESSING', // Hazırlanıyor
  SHIPPED = 'SHIPPED', // Kargoya verildi
  DELIVERED = 'DELIVERED', // Teslim edildi
  CANCELLED = 'CANCELLED', // İptal edildi
  REFUNDED = 'REFUNDED', // İade edildi
}
