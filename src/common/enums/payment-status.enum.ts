export enum PaymentStatus {
  INITIATED = 'INITIATED', // Ödeme başlatıldı
  REDIRECTED = 'REDIRECTED', // Kullanıcı ödeme sayfasına yönlendirildi
  SUCCESS = 'SUCCESS', // Ödeme başarılı
  FAILURE = 'FAILURE', // Ödeme başarısız
  CANCELLED = 'CANCELLED', // Ödeme iptal edildi
}
