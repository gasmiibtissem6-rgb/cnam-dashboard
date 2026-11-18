
import { createContext } from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isAdminSuperieur: boolean;
  isAgent: boolean;
  isValidator: boolean;
  isUser: boolean;
  isPrestataire: boolean;
  isSecurityEngineer: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  getDashboardRoute: () => string;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
