import {createContext, useContext, useState} from 'react'

type DrawerCtx = {
  drawerOpen: boolean
  setDrawerOpen: (v: boolean) => void
  hasDrawer: boolean
  setHasDrawer: (v: boolean) => void
}

const DrawerContext = createContext<DrawerCtx>({
  drawerOpen: false, setDrawerOpen: () => {},
  hasDrawer: false,  setHasDrawer: () => {},
})

export function DrawerProvider({children}: {children: React.ReactNode}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hasDrawer, setHasDrawer]   = useState(false)
  return (
    <DrawerContext.Provider value={{drawerOpen, setDrawerOpen, hasDrawer, setHasDrawer}}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawer() {
  return useContext(DrawerContext)
}
