export default function DashboardLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-400" />
        <div className="text-gray-600 text-sm font-medium">Loading…</div>
      </div>
    </div>
  )
}
