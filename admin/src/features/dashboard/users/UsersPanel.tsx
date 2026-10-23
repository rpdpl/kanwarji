"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Search, Users } from "lucide-react"
import type { User } from "@/features/dashboard/types"

type Props = {
  users: User[]
  userSearchTerm: string
  setUserSearchTerm: (v: string) => void
  toggleUserStatus: (userId: string, isActive: boolean) => void
}

export function UsersPanel({ users, userSearchTerm, setUserSearchTerm, toggleUserStatus }: Props) {
  return (
    <div className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-gray-900 text-lg sm:text-xl flex items-center">
                      <Users className="h-5 w-5 mr-2 text-red-400" /> User Management
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-sm sm:text-base">Manage user accounts and permissions</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <label htmlFor="user-search" className="sr-only">
                      Search users
                    </label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="user-search"
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      placeholder="Search by name or phone"
                      className="pl-8 border-gray-300 focus:border-red-400 focus:ring-red-400"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {(() => {
                    const filteredUsers = users.filter((user) =>
                      user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                      user.phone.toLowerCase().includes(userSearchTerm.toLowerCase())
                    )

                    return filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <div
                          key={user._id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors space-y-3 sm:space-y-0"
                        >
                          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                            <div className="bg-red-100 p-2 rounded-full flex-shrink-0">
                              <Users className="h-4 w-4 text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{user.name}</div>
                              <div className="text-xs sm:text-sm text-gray-600 mt-0.5">{user.email}</div>
                              <div className="text-xs sm:text-sm text-gray-500">{user.phone}</div>
                              <Badge
                                variant={user.userType === "admin" ? "default" : "secondary"}
                                className={`mt-2 sm:mt-1 inline-flex ${user.userType === "admin" ? "bg-red-400 hover:bg-red-400" : "bg-gray-100 text-gray-700"
                                  }`}
                              >
                                {user.userType}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-3 w-full sm:w-auto">
                            <span className={`text-xs sm:text-sm font-medium flex-shrink-0 ${user.isActive ? "text-red-400" : "text-gray-500"}`}>
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={(checked) => toggleUserStatus(user._id, checked)}
                              className="data-[state=checked]:bg-red-400"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
                        No users found matching "{userSearchTerm}"
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
    </div>
  )
}
