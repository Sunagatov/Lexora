import {createContext, useContext, useState} from 'react'
import type {ReactNode} from 'react'

type DrawerCtx = {
  drawerOpen: boolean
  setDrawerOpen: (v: boolean) => void
  hasDrawer: boolean
  setHasDrawer: (v: boolean) => void
}

const DrawerContext = createContext<DrawerCtx | null>(null)

export function DrawerProvider({children}: {children: ReactNode}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hasDrawer, setHasDrawer]   = useState(false)
  return (
    <DrawerContext.Provider value={{drawerOpen, setDrawerOpen, hasDrawer, setHasDrawer}}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawer(): DrawerCtx {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error('useDrawer must be used inside DrawerProvider')
  return ctx
}
