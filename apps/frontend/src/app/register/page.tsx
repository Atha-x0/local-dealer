"use client";

import { useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from '@/lib/api';

export default function RegisterDealerPage() {
  const [formData, setFormData] = useState({
    store_name: "",
    phone: "",
    address: "",
    city: "",
    latitude: "",
    longitude: "",
    product_title: "",
    product_brand: "",
    product_price: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          }));
        },
        (error) => {
          alert("Error getting location: " + error.message);
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    
    try {
      const payload: any = {
        store_name: formData.store_name,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };

      if (formData.product_title && formData.product_price) {
        payload.initial_product = {
          title: formData.product_title,
          brand: formData.product_brand,
          price: parseFloat(formData.product_price),
        };
      }

      const res = await fetch(`${API_BASE_URL}/api/dealers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to register dealer");
      }

      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "An error occurred");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0f172a] rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-2xl text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Registration Successful!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Your store and initial inventory have been indexed. You will now appear in local search results.
          </p>
          <Link href="/" className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
            Return to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[100px] pointer-events-none" />
      
      <div className="max-w-3xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mb-4">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">Partner Registration</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Join our network and list your local inventory instantly.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl p-8 sm:p-10">
          <div className="space-y-8">
            
            {/* Store Details Section */}
            <div>
              <h3 className="text-xl font-semibold mb-5 flex items-center border-b border-gray-200 dark:border-gray-800 pb-3">
                <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3 text-sm">1</span>
                Store Details
              </h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Store Name</label>
                  <input required name="store_name" value={formData.store_name} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Reliance Digital" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone Number</label>
                  <input required name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="+91 9876543210" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">City</label>
                  <input required name="city" value={formData.city} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Mumbai" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Full Address</label>
                  <input required name="address" value={formData.address} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="123 Market St, Shop 5" />
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div>
              <h3 className="text-xl font-semibold mb-5 flex items-center border-b border-gray-200 dark:border-gray-800 pb-3">
                <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3 text-sm">2</span>
                Location Mapping
              </h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Latitude</label>
                  <input name="latitude" value={formData.latitude} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 outline-none" placeholder="19.0760" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Longitude</label>
                  <input name="longitude" value={formData.longitude} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 outline-none" placeholder="72.8777" />
                </div>
                <div className="sm:col-span-2">
                  <button type="button" onClick={handleGetLocation} className="w-full py-2.5 border border-dashed border-gray-400 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Auto-detect GPS Location
                  </button>
                </div>
              </div>
            </div>

            {/* Inventory Section */}
            <div>
              <h3 className="text-xl font-semibold mb-5 flex items-center border-b border-gray-200 dark:border-gray-800 pb-3">
                <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3 text-sm">3</span>
                Initial Listing <span className="text-sm font-normal text-gray-500 ml-2">(Optional)</span>
              </h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Product Title</label>
                  <input name="product_title" value={formData.product_title} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Sony Bravia 55 inch 4K TV" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Brand</label>
                  <input name="product_brand" value={formData.product_brand} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Sony" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Selling Price (INR)</label>
                  <input type="number" name="product_price" value={formData.product_price} onChange={handleChange} className="w-full bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="50000" />
                </div>
              </div>
            </div>

          </div>

          {errorMessage && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-800">
              {errorMessage}
            </div>
          )}

          <div className="mt-10">
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg font-semibold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Registering Store..." : "Register & Go Live"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
