export default function ExecutiveDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">Executive Dashboard</h1>
      <p className="mt-2 text-foreground">Company-wide financial overview and KPIs</p>
      
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI Cards will go here */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-foreground/80">Total Revenue</h3>
          <p className="mt-2 text-3xl font-semibold">$0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-foreground/80">Total Backlog</h3>
          <p className="mt-2 text-3xl font-semibold">$0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-foreground/80">Average Margin</h3>
          <p className="mt-2 text-3xl font-semibold">0%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-foreground/80">Active Projects</h3>
          <p className="mt-2 text-3xl font-semibold">0</p>
        </div>
      </div>
    </div>
  )
}