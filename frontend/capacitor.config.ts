import type {CapacitorConfig} from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uk.zuf.lexora',
  appName: 'Lexora',
  webDir: 'dist',
  zoomEnabled: true,
  // Native HTTP and file sharing pass private data through the bridge.
  loggingBehavior: 'none',
  plugins: {
    CapacitorHttp: {enabled: true},
  },
}

export default config
