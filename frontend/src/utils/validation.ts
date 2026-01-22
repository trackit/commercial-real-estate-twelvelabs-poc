export function isValidApiKey(key: string): boolean {
  return key.length >= 10
}

export function isValidVideoFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v']
  const maxSize = 2 * 1024 * 1024 * 1024

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload MP4 or MOV files.' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 2GB.' }
  }

  return { valid: true }
}

export function isValidAddress(address: string): boolean {
  return address.trim().length >= 5
}
