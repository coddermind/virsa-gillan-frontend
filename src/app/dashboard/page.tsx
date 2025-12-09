"use client";

import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Check if user_type is missing (old session) - if so, treat as non-manager
  // User needs to log out and log back in to get updated user data
  const isManager = user?.user_type === "manager";

  // If user_type is missing, it means the session is stale - user needs to log out and log back in
  if (!user?.user_type) {
    return (
      <DashboardLayout>
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Dashboard</h2>
            <p className="text-[var(--text-secondary)] transition-colors duration-300">Welcome to your event management dashboard</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🔄</div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Session Update Required</h3>
              <p className="text-[var(--text-secondary)] mb-6">
                Your session needs to be refreshed to access the latest features. Please log out and log back in to continue.
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                This happens when system updates are applied. Simply log out and log back in to get the updated permissions.
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isManager) {
    return (
      <DashboardLayout>
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Dashboard</h2>
            <p className="text-[var(--text-secondary)] transition-colors duration-300">Welcome to your event management dashboard</p>
          </div>
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Access Restricted</h3>
              <p className="text-[var(--text-secondary)] mb-6">
                You don't have permission to access this section. Only managers can perform actions in this system.
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Please contact your administrator to be assigned manager privileges.
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Dashboard</h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">Welcome to your event management dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Quick Start</h3>
              <div className="w-12 h-12 bg-[var(--border)]/20 rounded-lg flex items-center justify-center border border-[var(--border)]">
                <span className="text-2xl">🚀</span>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              Use the sidebar to navigate between Cuisines, Item Types, and Sub Items. 
              Start by creating your first cuisine!
            </p>
          </div>

          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Getting Started</h3>
              <div className="w-12 h-12 bg-[var(--border)]/20 rounded-lg flex items-center justify-center border border-[var(--border)]">
                <span className="text-2xl">📚</span>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              1. Create cuisines (Italian, Asian, etc.)<br />
              2. Add item types (APPETIZERS, SALAD, etc.)<br />
              3. Add sub items to each cuisine and item type
            </p>
          </div>

          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Tips</h3>
              <div className="w-12 h-12 bg-[var(--border)]/20 rounded-lg flex items-center justify-center border border-[var(--border)]">
                <span className="text-2xl">💡</span>
              </div>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              You can collapse the sidebar by clicking the arrow button. 
              The sidebar state will be saved for your next visit.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

