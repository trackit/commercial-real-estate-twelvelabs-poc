export function isValidVideoFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/x-matroska']
  const validExtensions = ['.mp4', '.mov', '.m4v', '.mkv']
  const maxSize = 2 * 1024 * 1024 * 1024

  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  const hasValidType = validTypes.includes(file.type)
  const hasValidExtension = validExtensions.includes(extension)

  if (!hasValidType && !hasValidExtension) {
    return { valid: false, error: 'Invalid file type. Please upload MP4, MOV, or MKV files.' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum size is 2GB.' }
  }

  return { valid: true }
}
