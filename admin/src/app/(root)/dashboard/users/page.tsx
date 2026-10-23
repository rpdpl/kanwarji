"use client"

import { UsersPanel } from "@/features/dashboard/users/UsersPanel"
import { useDashboard } from "@/features/dashboard/dashboard-context"

export default function UsersPage() {
  const { users, userSearchTerm, setUserSearchTerm, toggleUserStatus } = useDashboard()
  return (
    <UsersPanel
      users={users}
      userSearchTerm={userSearchTerm}
      setUserSearchTerm={setUserSearchTerm}
      toggleUserStatus={toggleUserStatus}
    />
  )
}
