import { useState } from 'react'
import { MenuItemForm } from './components/MenuItemForm'
import { MenuItemList } from './components/MenuItemList'

export default function MenuEditorPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cardápio Digital</h1>
          <p className="text-muted-foreground">
            Gerencie seu cardápio online
          </p>
        </div>
        <MenuItemForm onSuccess={handleSuccess} />
      </div>

      <MenuItemList 
        refreshTrigger={refreshTrigger} 
        onRefresh={handleSuccess}
      />
    </div>
  )
}
