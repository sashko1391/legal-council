import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui'

export default function HistoryPage() {
  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Історія Аналізів</h1>
        <p className="text-gray-500">
          Перегляд попередніх аналізів контрактів
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Історія порожня</CardTitle>
          <CardDescription>
            Ви ще не проводили жодного аналізу
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Почніть з аналізу вашого першого контракту на сторінці "Огляд Контрактів"
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
