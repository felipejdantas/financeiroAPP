import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "system"
export type ThemeColor = "orange" | "violet" | "emerald" | "rose" | "blue"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultColor?: ThemeColor
  storageKey?: string
  colorStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  color: ThemeColor
  setColor: (color: ThemeColor) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  color: "orange",
  setColor: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultColor = "orange",
  storageKey = "vite-ui-theme",
  colorStorageKey = "vite-ui-color-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [color, setColor] = useState<ThemeColor>(
    () => (localStorage.getItem(colorStorageKey) as ThemeColor) || defaultColor
  )

  useEffect(() => {
    const root = window.document.documentElement

    // Handle Light/Dark Mode
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  useEffect(() => {
    const root = window.document.documentElement

    // Handle Color Theme
    // Remove all known theme color classes
    root.classList.remove("theme-orange", "theme-violet", "theme-emerald", "theme-rose", "theme-blue")
    
    // Add new theme color class
    root.classList.add(`theme-${color}`)
  }, [color])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    color,
    setColor: (color: ThemeColor) => {
        localStorage.setItem(colorStorageKey, color)
        setColor(color)
    }
  }

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
