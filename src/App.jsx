import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyDetails from './pages/PropertyDetails';
import Issues from './pages/Issues';
import Tenants from './pages/Tenants';
import TenantDetails from './pages/TenantDetails';
import Documents from './pages/Documents';
import Costs from './pages/Costs';
import Contacts from './pages/Contacts';
import Rentals from './pages/Rentals';
import { DataProvider } from './context/DataContext';


function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="properties" element={<Properties />} />
            <Route path="properties/:id" element={<PropertyDetails />} />
            <Route path="issues" element={<Issues />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="tenants/:id" element={<TenantDetails />} />
            <Route path="documents" element={<Documents />} />
            <Route path="costs" element={<Costs />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="rentals" element={<Rentals />} />
            <Route path="rentals/:id" element={<Rentals />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
