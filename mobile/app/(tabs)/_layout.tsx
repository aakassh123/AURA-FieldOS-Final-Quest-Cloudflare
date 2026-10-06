import { Tabs } from 'expo-router';
import { Home, ListTodo, MapPin, User } from 'lucide-react-native';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#14B8A6', tabBarInactiveTintColor: '#64748B', tabBarStyle: { height: 68, paddingBottom: 8, paddingTop: 6 }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Home size={20} color={color} /> }} />
    <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: ({ color }) => <ListTodo size={20} color={color} /> }} />
    <Tabs.Screen name="visits" options={{ title: 'Visits', tabBarIcon: ({ color }) => <MapPin size={20} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <User size={20} color={color} /> }} />
  </Tabs>;
}
