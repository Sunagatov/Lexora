import {afterEach, expect, it, vi} from 'vitest'
import {Directory, Filesystem} from '@capacitor/filesystem'
import {Share} from '@capacitor/share'
import {saveFile} from './saveFile'

const platform = vi.hoisted(() => ({isIOSApp: false}))
vi.mock('@/shared/platform', () => platform)
vi.mock('@capacitor/filesystem', () => ({
  Directory: {Cache: 'CACHE'},
  Filesystem: {writeFile: vi.fn(), rmdir: vi.fn()},
}))
vi.mock('@capacitor/share', () => ({Share: {share: vi.fn()}}))

afterEach(() => {
  platform.isIOSApp = false
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('shares the exact export bytes and clears the temporary file when the sheet closes', async () => {
  platform.isIOSApp = true
  const uri = 'file:///cache/export.xlsx'
  vi.mocked(Filesystem.writeFile).mockResolvedValue({uri})
  vi.mocked(Filesystem.rmdir).mockResolvedValue(undefined)
  vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'))

  await saveFile(new Blob([new Uint8Array([0x50, 0x4b, 0xff])]), 'export.xlsx')

  expect(Filesystem.writeFile).toHaveBeenCalledWith({
    path: expect.stringMatching(/^lexora-export-[\d-]+\/export\.xlsx$/),
    directory: Directory.Cache,
    data: 'UEv/',
    recursive: true,
  })
  expect(Share.share).toHaveBeenCalledWith({files: [uri]})
  const [{path}] = vi.mocked(Filesystem.writeFile).mock.calls[0]
  expect(Filesystem.rmdir).toHaveBeenCalledWith({
    path: path.split('/')[0],
    directory: Directory.Cache,
    recursive: true,
  })
})

it('downloads the file in a browser and releases its object URL', async () => {
  vi.useFakeTimers()
  const url = 'blob:lexora-export'
  const createObjectURL = vi.fn(() => url)
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {createObjectURL, revokeObjectURL}))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('export.xlsx')
    expect(this.href).toBe(url)
    expect(this.isConnected).toBe(true)
  })
  const blob = new Blob(['spreadsheet'])

  await saveFile(blob, 'export.xlsx')
  vi.runAllTimers()

  expect(createObjectURL).toHaveBeenCalledWith(blob)
  expect(click).toHaveBeenCalledOnce()
  expect(revokeObjectURL).toHaveBeenCalledWith(url)
  expect(Share.share).not.toHaveBeenCalled()
})
