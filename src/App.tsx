import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Revenue from "./pages/Revenue";
import Expenses from "./pages/Expenses";
import Categories from "./pages/Categories";
import Planning from "./pages/Planning";
import Scheduling from "./pages/Scheduling";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import { FixedCosts } from "./pages/FixedCosts";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

import { ThemeProvider } from "@/components/theme-provider";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" defaultColor="orange" storageKey="vite-ui-theme" colorStorageKey="vite-ui-color-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="revenues" element={<Revenue />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="categories" element={<Categories />} />
              <Route path="fixed-costs" element={<FixedCosts />} />
              <Route path="planning" element={<Planning />} />
              <Route path="scheduling" element={<Scheduling />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
