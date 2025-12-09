// Get API base URL from environment variable
// Remove trailing slash if present, and ensure /api is appended
const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  
  if (envUrl) {
    // Remove trailing slash and ensure /api is at the end
    const cleanUrl = envUrl.replace(/\/$/, "");
    return cleanUrl.endsWith("/api") ? cleanUrl : `${cleanUrl}/api`;
  }
  
  // Default fallback
  return "http://localhost:8000/api";
};

const API_BASE_URL = getApiBaseUrl();

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  user_type: "user" | "manager";
  user_type_display: string;
  date_joined: string;
}

export interface Cuisine {
  id: number;
  name: string;
  description: string;
  price?: string | number;
  image?: File | string;
  image_url?: string;
  user: string;
  sub_items_count: number;
  created_at: string;
  updated_at: string;
}

export interface ItemType {
  id: number;
  name: string;
  description: string;
  user: string;
  sub_items_count: number;
  created_at: string;
  updated_at: string;
}

export interface SubItem {
  id: number;
  name: string;
  description: string;
  image?: File | string;
  image_url?: string;
  price?: string;
  item_type: number;
  item_type_name: string;
  cuisine: number;
  cuisine_name: string;
  user: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetEntry {
  id: number;
  event: number;
  event_name: string;
  name: string;
  type: "payable" | "paid";
  type_display: string;
  amount: string;
  date: string;
  user: string;
  created_at: string;
  updated_at: string;
}

export interface EventPayment {
  id: number;
  event: number;
  event_name: string;
  amount: string;
  payment_method: "cash" | "credit_card" | "debit_card" | "bank_transfer" | "check" | "paypal" | "venmo" | "zelle" | "other";
  payment_method_display: string;
  payment_date: string;
  notes?: string;
  user: string;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  weekdays: number[];
  weekday_names: string[];
  user: string;
  created_at: string;
  updated_at: string;
}

export interface SelectedMenuDetail {
  id: number;
  name: string;
  price: string;
  item_type_name: string;
  cuisine_name: string;
}

export interface Extra {
  name: string;
  charges: number;
}

export interface Event {
  id: number;
  name: string;
  location: string;
  date: string;
  time_slot?: number;
  time_slot_name?: string;
  time_slot_display?: string;
  start_time?: string;
  end_time?: string;
  date_time: string;
  cuisine?: number;
  cuisine_name?: string;
  selected_menus?: number[];
  selected_menus_details?: SelectedMenuDetail[];
  number_of_persons?: number;
  menu_total?: number;
  extras?: Extra[];
  additional_charges?: number;
  total_charges: number;
  customer_name: string;
  customer_contact?: string;
  customer_address?: string;
  status?: "draft" | "pending_approval" | "approved" | "cancelled";
  user: string;
  budget_entries_count: number;
  total_payable: number;
  total_paid: number;
  total_payments_received: number;
  pending_charges: number;
  created_at: string;
  updated_at: string;
  budget_entries?: BudgetEntry[];
  event_payments?: EventPayment[];
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("token");
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("token", token);
      } else {
        localStorage.removeItem("token");
      }
    }
  }

  /**
   * Helper method to handle paginated responses from DRF
   * Returns the results array if paginated, otherwise returns the data as-is
   */
  private handlePaginatedResponse<T>(data: any): T {
    // Check if response is paginated (has 'results' property)
    if (data && typeof data === "object" && "results" in data && Array.isArray(data.results)) {
      return data.results as T;
    }
    // If not paginated, return data as-is
    return data as T;
  }

  /**
   * Request method for file uploads using FormData
   */
  private async requestWithFile<T>(
    endpoint: string,
    data: any,
    method: string = "POST"
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const formData = new FormData();

    // Add all fields to FormData
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (value !== undefined) {
        // Handle null values explicitly (for image removal)
        if (value === null) {
          // For Django, send empty string to clear the field
          formData.append(key, "");
        } else if (value instanceof File) {
          formData.append(key, value);
        } else if (typeof value === "object" && !(value instanceof File)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    const headers: HeadersInit = {};
    if (this.token) {
      headers["Authorization"] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Request failed";
        try {
          const error = await response.json();
          errorMessage = error.message || error.detail || error.error || errorMessage;
          
          // Handle validation errors
          const hasFieldErrors = Object.keys(error).some(
            key => Array.isArray(error[key]) || typeof error[key] === "string"
          );
          
          if (hasFieldErrors) {
            const fieldErrors = Object.entries(error)
              .filter(([key]) => key !== "detail")
              .map(([key, value]) => {
                if (Array.isArray(value)) {
                  return `${key}: ${value.join(", ")}`;
                }
                if (typeof value === "string") {
                  return `${key}: ${value}`;
                }
                return null;
              })
              .filter(Boolean)
              .join("; ");
            errorMessage = fieldErrors || errorMessage;
          }
        } catch {
          errorMessage = response.statusText || `HTTP ${response.status} error`;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const text = await response.text();
        return text ? JSON.parse(text) : ({} as T);
      }
      return {} as T;
    } catch (error: any) {
      if (error.name === "TypeError" || error.message === "Failed to fetch") {
        throw new Error(
          `Cannot connect to backend API at ${this.baseUrl}. Please check:\n` +
          `1. Backend server is running\n` +
          `2. BACKEND_URL in .env.local is correct\n` +
          `3. CORS is properly configured`
        );
      }
      throw error;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = "Request failed";
        try {
          const error = await response.json();
          errorMessage = error.message || error.detail || error.error || errorMessage;
          
          // Handle validation errors (check for any field errors)
          const hasFieldErrors = Object.keys(error).some(
            key => Array.isArray(error[key]) || typeof error[key] === "string"
          );
          
          if (hasFieldErrors) {
            const fieldErrors = Object.entries(error)
              .filter(([key]) => key !== "detail") // Exclude generic detail field
              .map(([key, value]) => {
                if (Array.isArray(value)) {
                  return `${key}: ${value.join(", ")}`;
                }
                if (typeof value === "string") {
                  return `${key}: ${value}`;
                }
                return null;
              })
              .filter(Boolean)
              .join("; ");
            errorMessage = fieldErrors || errorMessage;
          }
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || `HTTP ${response.status} error`;
        }
        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const text = await response.text();
        return text ? JSON.parse(text) : ({} as T);
      }
      return {} as T;
    } catch (error: any) {
      // Handle network errors
      if (error.name === "TypeError" || error.message === "Failed to fetch") {
        throw new Error(
          `Cannot connect to backend API at ${this.baseUrl}. Please check:\n` +
          `1. Backend server is running\n` +
          `2. BACKEND_URL in .env.local is correct\n` +
          `3. CORS is properly configured`
        );
      }
      throw error;
    }
  }

  // Auth endpoints
  async register(email: string, password: string, passwordConfirm: string, firstName?: string, lastName?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        password_confirm: passwordConfirm,
        first_name: firstName || "",
        last_name: lastName || "",
      }),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async getProfile(): Promise<User> {
    return this.request<User>("/auth/profile/");
  }

  // Cuisine endpoints
  async getCuisines(): Promise<Cuisine[]> {
    const response = await this.request<any>("/cuisines/");
    return this.handlePaginatedResponse<Cuisine[]>(response);
  }

  async getCuisine(id: number): Promise<Cuisine> {
    return this.request<Cuisine>(`/cuisines/${id}/`);
  }

  async createCuisine(data: Partial<Cuisine> & { image?: File }): Promise<Cuisine> {
    return this.requestWithFile<Cuisine>("/cuisines/", data, "POST");
  }

  async updateCuisine(id: number, data: Partial<Cuisine> & { image?: File }): Promise<Cuisine> {
    return this.requestWithFile<Cuisine>(`/cuisines/${id}/`, data, "PUT");
  }

  async deleteCuisine(id: number): Promise<void> {
    return this.request<void>(`/cuisines/${id}/`, {
      method: "DELETE",
    });
  }

  // ItemType endpoints
  async getItemTypes(): Promise<ItemType[]> {
    const response = await this.request<any>("/item-types/");
    return this.handlePaginatedResponse<ItemType[]>(response);
  }

  async getItemType(id: number): Promise<ItemType> {
    return this.request<ItemType>(`/item-types/${id}/`);
  }

  async createItemType(data: Partial<ItemType>): Promise<ItemType> {
    return this.request<ItemType>("/item-types/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateItemType(id: number, data: Partial<ItemType>): Promise<ItemType> {
    return this.request<ItemType>(`/item-types/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteItemType(id: number): Promise<void> {
    return this.request<void>(`/item-types/${id}/`, {
      method: "DELETE",
    });
  }

  // SubItem endpoints
  async getSubItems(cuisineId?: number, itemTypeId?: number): Promise<SubItem[]> {
    const params = new URLSearchParams();
    if (cuisineId) params.append("cuisine", cuisineId.toString());
    if (itemTypeId) params.append("item_type", itemTypeId.toString());
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await this.request<any>(`/sub-items/${query}`);
    return this.handlePaginatedResponse<SubItem[]>(response);
  }

  async getSubItem(id: number): Promise<SubItem> {
    return this.request<SubItem>(`/sub-items/${id}/`);
  }

  async createSubItem(data: Partial<SubItem> & { image?: File }): Promise<SubItem> {
    return this.requestWithFile<SubItem>("/sub-items/", data, "POST");
  }

  async updateSubItem(id: number, data: Partial<SubItem> & { image?: File }): Promise<SubItem> {
    return this.requestWithFile<SubItem>(`/sub-items/${id}/`, data, "PUT");
  }

  async deleteSubItem(id: number): Promise<void> {
    return this.request<void>(`/sub-items/${id}/`, {
      method: "DELETE",
    });
  }

  // TimeSlot endpoints
  async getTimeSlots(weekday?: number): Promise<TimeSlot[]> {
    const endpoint = weekday !== undefined ? `/time-slots/?weekday=${weekday}` : "/time-slots/";
    const response = await this.request<any>(endpoint);
    return this.handlePaginatedResponse<TimeSlot[]>(response);
  }

  async getTimeSlot(id: number): Promise<TimeSlot> {
    return this.request<TimeSlot>(`/time-slots/${id}/`);
  }

  async createTimeSlot(data: Partial<TimeSlot>): Promise<TimeSlot> {
    return this.request<TimeSlot>("/time-slots/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTimeSlot(id: number, data: Partial<TimeSlot>): Promise<TimeSlot> {
    return this.request<TimeSlot>(`/time-slots/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTimeSlot(id: number): Promise<void> {
    return this.request<void>(`/time-slots/${id}/`, {
      method: "DELETE",
    });
  }

  // Event endpoints
  async getEvents(): Promise<Event[]> {
    const response = await this.request<any>("/events/");
    return this.handlePaginatedResponse<Event[]>(response);
  }

  async getEvent(id: number): Promise<Event> {
    return this.request<Event>(`/events/${id}/`);
  }

  async createEvent(data: Partial<Event>): Promise<Event> {
    return this.request<Event>("/events/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: number, data: Partial<Event>): Promise<Event> {
    return this.request<Event>(`/events/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: number): Promise<void> {
    return this.request<void>(`/events/${id}/`, {
      method: "DELETE",
    });
  }

  // BudgetEntry endpoints
  async getBudgetEntries(eventId?: number): Promise<BudgetEntry[]> {
    const endpoint = eventId ? `/budget-entries/?event=${eventId}` : "/budget-entries/";
    const response = await this.request<any>(endpoint);
    return this.handlePaginatedResponse<BudgetEntry[]>(response);
  }

  async getBudgetEntry(id: number): Promise<BudgetEntry> {
    return this.request<BudgetEntry>(`/budget-entries/${id}/`);
  }

  async createBudgetEntry(data: Partial<BudgetEntry>): Promise<BudgetEntry> {
    return this.request<BudgetEntry>("/budget-entries/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBudgetEntry(id: number, data: Partial<BudgetEntry>): Promise<BudgetEntry> {
    return this.request<BudgetEntry>(`/budget-entries/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteBudgetEntry(id: number): Promise<void> {
    return this.request<void>(`/budget-entries/${id}/`, {
      method: "DELETE",
    });
  }

  // EventPayment endpoints
  async getEventPayments(eventId?: number): Promise<EventPayment[]> {
    const endpoint = eventId ? `/event-payments/?event=${eventId}` : "/event-payments/";
    const response = await this.request<any>(endpoint);
    return this.handlePaginatedResponse<EventPayment[]>(response);
  }

  async getEventPayment(id: number): Promise<EventPayment> {
    return this.request<EventPayment>(`/event-payments/${id}/`);
  }

  async createEventPayment(data: Partial<EventPayment>): Promise<EventPayment> {
    return this.request<EventPayment>("/event-payments/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateEventPayment(id: number, data: Partial<EventPayment>): Promise<EventPayment> {
    return this.request<EventPayment>(`/event-payments/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteEventPayment(id: number): Promise<void> {
    return this.request<void>(`/event-payments/${id}/`, {
      method: "DELETE",
    });
  }

  // Public API endpoints (no authentication required)
  async getPublicCalendar(userId?: string | number | null): Promise<{ 
    events: Event[]; 
    time_slots: TimeSlot[]; 
    cuisines: Cuisine[]; 
    item_types: ItemType[] 
  }> {
    const url = userId 
      ? `${API_BASE_URL}/public/calendar/?user_id=${userId}`
      : `${API_BASE_URL}/public/calendar/`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to fetch calendar" }));
      throw new Error(error.message || "Failed to fetch calendar");
    }
    return response.json();
  }

  async getPublicMenus(userId: number, cuisineId: number, itemTypeId: number): Promise<SubItem[]> {
    const response = await fetch(
      `${API_BASE_URL}/public/menus/?user_id=${userId}&cuisine=${cuisineId}&item_type=${itemTypeId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to fetch menus" }));
      throw new Error(error.message || "Failed to fetch menus");
    }
    return response.json();
  }

  async bookPublicEvent(data: Partial<Event> & { user_id?: number }): Promise<Event> {
    const response = await fetch(`${API_BASE_URL}/public/events/book/`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Failed to book event" }));
      // Handle both error formats: {error: "..."} or {message: "..."}
      const errorMessage = errorData.error || errorData.message || "Failed to book event";
      // If there are field errors, format them
      if (errorData.detail || (typeof errorData === 'object' && !errorData.error && !errorData.message)) {
        const fieldErrors = Object.entries(errorData)
          .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
          .join('; ');
        throw new Error(fieldErrors || "Validation error");
      }
      throw new Error(errorMessage);
    }
    const result = await response.json();
    // Handle response format: {event: {...}} or just {...}
    return result.event || result;
  }

  // Admin approval endpoints
  async getPendingEvents(): Promise<Event[]> {
    return this.request<Event[]>("/events/pending/");
  }

  async approveEvent(eventId: number, serviceCharges?: number, extras?: any[]): Promise<Event> {
    return this.request<Event>(`/events/${eventId}/approve/`, {
      method: "POST",
      body: JSON.stringify({
        action: "approve",
        service_charges: serviceCharges || 0,
        extras: extras || [],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async rejectEvent(eventId: number): Promise<Event> {
    return this.request<Event>(`/events/${eventId}/approve/`, {
      method: "POST",
      body: JSON.stringify({
        action: "reject",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

