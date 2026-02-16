import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { 
  TrendingUp, 
  DollarSign,
  MoreHorizontal,
  Box,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  ShoppingCart
} from 'lucide-react';
import { useState } from 'react';

interface ProductCategory {
  name: string;
  value: number;
  percentage: number;
  color: string;
  growth: string;
  status: 'up' | 'down' | 'neutral';
  products: number;
  avgPrice: number;
  topSeller?: string;
}

const categoryData: ProductCategory[] = [
  { 
    name: 'Premium', 
    value: 6450, 
    percentage: 36, 
    color: '#f59e0b',
    growth: '+12%',
    status: 'up',
    products: 145,
    avgPrice: 44.48,
    topSeller: 'Premium Suite'
  },
  { 
    name: 'Regular', 
    value: 5320, 
    percentage: 30, 
    color: '#6b7280',
    growth: '+5%',
    status: 'up',
    products: 289,
    avgPrice: 18.41,
    topSeller: 'Standard Pack'
  },
  { 
    name: 'New', 
    value: 3280, 
    percentage: 18, 
    color: '#10b981',
    growth: '+28%',
    status: 'up',
    products: 67,
    avgPrice: 48.96,
    topSeller: 'Starter Kit'
  },
  { 
    name: 'Others', 
    value: 2850, 
    percentage: 16, 
    color: '#e5e7eb',
    growth: '-3%',
    status: 'down',
    products: 103,
    avgPrice: 27.67,
    topSeller: 'Misc Items'
  }
];

const monthlySalesData = [
  { month: 'Jan', Premium: 5200, Regular: 4800, New: 2100, Others: 2900 },
  { month: 'Feb', Premium: 5400, Regular: 4900, New: 2400, Others: 2800 },
  { month: 'Mar', Premium: 5800, Regular: 5100, New: 2800, Others: 2700 },
  { month: 'Apr', Premium: 6200, Regular: 5300, New: 3200, Others: 2900 },
  { month: 'May', Premium: 6450, Regular: 5320, New: 3280, Others: 2850 }
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-sm">
        <p className="font-medium text-sm">{payload[0].name}</p>
        <p className="text-sm text-muted-foreground">
          ${payload[0].value.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">{payload[0].payload.percentage}%</p>
      </div>
    );
  }
  return null;
};

const getTrendIcon = (status: string) => {
  switch (status) {
    case 'up':
      return <ArrowUpRight className="w-3 h-3 text-green-600" />;
    case 'down':
      return <ArrowDownRight className="w-3 h-3 text-red-600" />;
    default:
      return <Minus className="w-3 h-3 text-gray-600" />;
  }
};

const getTrendColor = (status: string) => {
  switch (status) {
    case 'up':
      return 'text-green-600 bg-green-50';
    case 'down':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export function ProductCategoriesCard() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const totalRevenue = categoryData.reduce((sum, item) => sum + item.value, 0);
  const totalProducts = categoryData.reduce((sum, item) => sum + item.products, 0);
  const avgGrowth = '+10.5%';

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Product Categories</CardTitle>
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Revenue Overview */}
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
          </div>
          <div className="text-xs text-muted-foreground">Total Revenue by Category</div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3 text-green-600" />
            <span className="text-xs text-green-600">{avgGrowth} vs last month</span>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    onClick={() => setSelectedCategory(entry.name)}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Category Performance</div>
          <div className="space-y-2">
            {categoryData.map((category) => (
              <div
                key={category.name}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedCategory === category.name 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-muted/30 border-border hover:bg-muted/50'
                }`}
                onClick={() => setSelectedCategory(category.name)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm font-medium">{category.name}</span>
                    <div className="flex items-center gap-1">
                      <Box className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{category.products}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs ${getTrendColor(category.status)}`}>
                    {getTrendIcon(category.status)}
                    {category.growth}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <div className="text-muted-foreground">Revenue</div>
                    <div className="font-medium">${category.value.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg Price</div>
                    <div className="font-medium">${category.avgPrice}</div>
                  </div>
                </div>

                {category.topSeller && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span>Top: {category.topSeller}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Sales Trend */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">5-Month Trend</div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySalesData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', padding: '4px' }}
                  labelStyle={{ fontSize: '10px' }}
                />
                <Bar dataKey="Premium" fill="#f59e0b" />
                <Bar dataKey="Regular" fill="#6b7280" />
                <Bar dataKey="New" fill="#10b981" />
                <Bar dataKey="Others" fill="#e5e7eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-sm font-bold">{totalProducts}</div>
            <div className="text-xs text-muted-foreground">Products</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-sm font-bold">${Math.round(totalRevenue / totalProducts)}</div>
            <div className="text-xs text-muted-foreground">Avg Price</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-sm font-bold">4</div>
            <div className="text-xs text-muted-foreground">Categories</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            <ShoppingCart className="w-3 h-3 mr-1" />
            Manage Products
          </Button>
          <Button size="sm" className="flex-1 text-xs">
            <Activity className="w-3 h-3 mr-1" />
            View Analytics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
