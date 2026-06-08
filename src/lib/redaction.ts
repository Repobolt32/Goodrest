export function redactPhone(phone: string): string {
  if (process.env.NODE_ENV === 'production') {
    return phone.length > 4 ? '****' + phone.slice(-4) : '****';
  }
  return phone;
}
