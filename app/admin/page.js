import "./admin.css";
import AdminApp from "@/components/admin/AdminApp";

export const metadata = { title: "Panel · Fortunato", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminApp />;
}
