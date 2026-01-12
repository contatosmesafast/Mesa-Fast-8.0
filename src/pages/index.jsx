import Layout from "./Layout.jsx";

import AdminBilling from "./AdminBilling";

import AdminDashboard from "./AdminDashboard";

import AdminMenu from "./AdminMenu";

import AdminReports from "./AdminReports";

import AdminStaff from "./AdminStaff";

import AdminTables from "./AdminTables";

import BlockedAccount from "./BlockedAccount";

import CustomerMenu from "./CustomerMenu";

import CustomerRating from "./CustomerRating";

import Home from "./Home";

import SuperAdmin from "./SuperAdmin";

import TableOrder from "./TableOrder";

import WaiterDashboard from "./WaiterDashboard";

import WaiterOrders from "./WaiterOrders";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    AdminBilling: AdminBilling,
    
    AdminDashboard: AdminDashboard,
    
    AdminMenu: AdminMenu,
    
    AdminReports: AdminReports,
    
    AdminStaff: AdminStaff,
    
    AdminTables: AdminTables,
    
    BlockedAccount: BlockedAccount,
    
    CustomerMenu: CustomerMenu,
    
    CustomerRating: CustomerRating,
    
    Home: Home,
    
    SuperAdmin: SuperAdmin,
    
    TableOrder: TableOrder,
    
    WaiterDashboard: WaiterDashboard,
    
    WaiterOrders: WaiterOrders,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<AdminBilling />} />
                
                
                <Route path="/AdminBilling" element={<AdminBilling />} />
                
                <Route path="/AdminDashboard" element={<AdminDashboard />} />
                
                <Route path="/AdminMenu" element={<AdminMenu />} />
                
                <Route path="/AdminReports" element={<AdminReports />} />
                
                <Route path="/AdminStaff" element={<AdminStaff />} />
                
                <Route path="/AdminTables" element={<AdminTables />} />
                
                <Route path="/BlockedAccount" element={<BlockedAccount />} />
                
                <Route path="/CustomerMenu" element={<CustomerMenu />} />
                
                <Route path="/CustomerRating" element={<CustomerRating />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/SuperAdmin" element={<SuperAdmin />} />
                
                <Route path="/TableOrder" element={<TableOrder />} />
                
                <Route path="/WaiterDashboard" element={<WaiterDashboard />} />
                
                <Route path="/WaiterOrders" element={<WaiterOrders />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}