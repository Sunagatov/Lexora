import {isIOSApp} from '@/shared/platform'

export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (isIOSApp) {
    const [{Filesystem, Directory}, {Share}] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error)
      reader.onload = () => {
        const url = String(reader.result)
        resolve(url.slice(url.indexOf(',') + 1))
      }
      reader.readAsDataURL(blob)
    })
    const directory = Directory.Cache
    const folder = `lexora-export-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`
    const name = filename.replace(/[\\/]/g, '_')
    const path = `${folder}/${!name || name === '.' || name === '..' ? 'lexora-export' : name}`
    try {
      const {uri} = await Filesystem.writeFile({path, directory, data, recursive: true})
      await Share.share({files: [uri]}).catch(error => {
        // The iOS Share plugin reports dismissal as a rejection.
        if (!(error instanceof Error && error.message === 'Share canceled')) throw error
      })
    } finally {
      await Filesystem.rmdir({path: folder, directory, recursive: true}).catch(() => {})
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
