import React, { useState, useEffect } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";

export default function POIManager() {
  const [pois, setPois] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category_id: "",
    lat: "",
    lng: "",
    image_url: "",
    gmaps_url: "",
    is_public: true,
  });

  useEffect(() => {
    loadPOIs();
  }, []);

  const loadPOIs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/public/pois`);
      const data = await response.json();

      setPois(data.pois || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to load POIs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (poi) => {
    const category = categories.find((c) => c.id === poi.category);
    setFormData({
      name: poi.name || "",
      description: poi.description || "",
      category_id: category?.id || "",
      lat: poi.lat || "",
      lng: poi.lng || "",
      image_url: poi.image || "",
      gmaps_url: poi.gmaps || "",
      is_public: poi.isPublic !== false,
    });
    setSelectedPOI(poi);
    setIsEditing(true);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setFormData({
      name: "",
      description: "",
      category_id: categories[0]?.id || "",
      lat: "",
      lng: "",
      image_url: "",
      gmaps_url: "",
      is_public: true,
    });
    setSelectedPOI(null);
    setIsEditing(false);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setSelectedPOI(null);
    setIsEditing(false);
    setShowAddForm(false);
    setFormData({
      name: "",
      description: "",
      category_id: "",
      lat: "",
      lng: "",
      image_url: "",
      gmaps_url: "",
      is_public: true,
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // TODO: Implement API call to save POI
    console.log("Saving POI:", formData);
    alert("POI save functionality will be implemented with backend API");
    handleCancel();
  };

  const handleDelete = async (poi) => {
    if (!confirm(`Are you sure you want to delete "${poi.name}"?`)) {
      return;
    }
    // TODO: Implement API call to delete POI
    console.log("Deleting POI:", poi);
    alert("POI delete functionality will be implemented with backend API");
  };

  const getCategoryLabel = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.label || categoryId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-gray-500">Loading POIs...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* POI List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Points of Interest</h2>
          <button
            onClick={handleAdd}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            + Add Point
          </button>
        </div>

        <div className="overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pois.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No points of interest found. Click "Add Point" to create
                    one.
                  </td>
                </tr>
              ) : (
                pois.map((poi) => (
                  <tr key={poi.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{poi.name}</td>
                    <td className="px-4 py-3">
                      {getCategoryLabel(poi.category)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {poi.lat && poi.lng ? `${poi.lat}, ${poi.lng}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset " +
                          (poi.isPublic
                            ? "bg-green-50 text-green-700 ring-green-200"
                            : "bg-gray-50 text-gray-600 ring-gray-200")
                        }
                      >
                        {poi.isPublic ? "Public" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(poi)}
                        className="rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(poi)}
                        className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Form */}
      <div className="lg:col-span-1">
        {(isEditing || showAddForm) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sticky top-20">
            <div className="text-sm font-medium mb-4">
              {isEditing ? "Edit Point of Interest" : "Add New Point"}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Camping site 2"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Discover multiple kinds of birds living here."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Latitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="lat"
                    value={formData.lat}
                    onChange={handleInputChange}
                    required
                    step="0.000001"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="-43.7695"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Longitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="lng"
                    value={formData.lng}
                    onChange={handleInputChange}
                    required
                    step="0.000001"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="172.4867"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  name="image_url"
                  value={formData.image_url}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Google Maps URL
                </label>
                <input
                  type="url"
                  name="gmaps_url"
                  value={formData.gmaps_url}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="https://maps.google.com/?q=-43.7695,172.4867"
                />
                <p className="mt-1 text-xs text-gray-500">
                  For navigation to this point
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <label htmlFor="is_public" className="text-sm text-gray-600">
                  Visible to public
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-xl px-3 py-2 text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        {!isEditing && !showAddForm && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium mb-2">Quick Tips</div>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Click "Edit" to modify a point</li>
              <li>• Use "Add Point" to create new locations</li>
              <li>• Toggle visibility to hide/show on public map</li>
              <li>• Add Google Maps URLs for navigation</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
