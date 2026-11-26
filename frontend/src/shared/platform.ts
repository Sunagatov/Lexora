import {Capacitor} from '@capacitor/core'

export const isIOSApp = Capacitor.getPlatform() === 'ios'
