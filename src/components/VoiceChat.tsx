"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, X, Volume2 } from "lucide-react";
import { GoogleGenAI, LiveServerMessage, Modality, Session } from "@google/genai";
import { createBlob, decode, decodeAudioData } from "@/lib/audioUtils";
import WaveVisualization from "./WaveVisualization";
import { apiClient } from "@/lib/api";

interface VoiceChatProps {
  onClose: () => void;
  containerBg?: string;
  textColor?: string;
  embedToken?: string | null;
  events?: any[];
  timeSlots?: any[];
  cuisines?: any[];
  itemTypes?: any[];
  subItems?: any[]; // Menu items (SubItems)
  currentMonth?: Date;
}

export default function VoiceChat({
  onClose,
  containerBg = "#ffffff",
  textColor = "#111827",
  embedToken,
  events,
  timeSlots,
  cuisines,
  itemTypes,
  subItems,
  currentMonth,
}: VoiceChatProps) {
  // UI State
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState("");
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [pendingBookingData, setPendingBookingData] = useState<any>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmedBookingData, setConfirmedBookingData] = useState<any>(null);

  // Gemini Live API refs
  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const isMountedRef = useRef(true);

  // Audio Context refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);

  // Audio capture refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const isRecordingRef = useRef(false);

  // Audio playback refs
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  /**
   * Build nested menu data structure (manager-specific)
   * Structure: cuisines → menus → menu_items
   */
  const buildMenuData = (): string => {
    // IMPORTANT: All data is already filtered by embed_token on the backend
    // The embed_token identifies the specific manager/admin, so all data here is manager-specific
    
    console.log("🔍 Building nested menu data - Input data:", {
      cuisinesCount: cuisines?.length || 0,
      itemTypesCount: itemTypes?.length || 0,
      subItemsCount: subItems?.length || 0,
      sampleSubItem: subItems?.[0] || null,
    });
    
    // Build nested structure: cuisines containing menus containing menu_items
    const cuisinesData = (cuisines || []).map((cuisine: any) => {
      // Find all menu items for this cuisine
      // IMPORTANT: subItems should have 'cuisine' field as ID (number)
      const cuisineMenuItems = (subItems || []).filter((item: any) => {
        // Handle both number and string comparisons
        const itemCuisineId = typeof item.cuisine === 'number' ? item.cuisine : parseInt(String(item.cuisine));
        const cuisineId = typeof cuisine.id === 'number' ? cuisine.id : parseInt(String(cuisine.id));
        return itemCuisineId === cuisineId;
      });
      
      console.log(`🍽️ Cuisine "${cuisine.name}" (ID: ${cuisine.id}) has ${cuisineMenuItems.length} menu items`);
      
      // Group menu items by their menu (item_type)
      const menusMap = new Map<number, any>();
      
      cuisineMenuItems.forEach((item: any) => {
        // IMPORTANT: subItems should have 'item_type' field as ID (number)
        const menuId = typeof item.item_type === 'number' ? item.item_type : parseInt(String(item.item_type));
        const menuName = item.item_type_name || "";
        
        if (!menuId || isNaN(menuId)) {
          console.warn("⚠️ Menu item missing valid item_type ID:", item);
          return;
        }
        
        if (!menusMap.has(menuId)) {
          // Find the menu details from itemTypes
          const menuDetails = itemTypes?.find((menu: any) => {
            const menuIdNum = typeof menu.id === 'number' ? menu.id : parseInt(String(menu.id));
            return menuIdNum === menuId;
          });
          menusMap.set(menuId, {
            menu_id: menuId,
            menu_name: menuName || menuDetails?.name || `Menu ID: ${menuId}`,
            menu_items: [],
          });
        }
        
        // Check if cuisine has a price set
        const cuisineHasPrice = cuisine.price != null && cuisine.price !== "" && parseFloat(String(cuisine.price)) > 0;
        
        // Add menu item to the menu
        const menuItem = {
          menu_item_id: item.id,
          menu_item_name: item.name,
          menu_item_price: !cuisineHasPrice && item.price ? parseFloat(String(item.price)) : null,
        };
        
        menusMap.get(menuId)!.menu_items.push(menuItem);
      });
      
      // Convert map to array and sort by menu_id
      const menusArray = Array.from(menusMap.values()).sort((a, b) => a.menu_id - b.menu_id);
      
      console.log(`📋 Cuisine "${cuisine.name}" has ${menusArray.length} menus:`, menusArray.map(m => `${m.menu_name} (${m.menu_items.length} items)`));
      
      return {
        cuisine_id: cuisine.id,
        cuisine_name: cuisine.name,
        cuisine_price: cuisine.price ? parseFloat(String(cuisine.price)) : null,
        menus: menusArray,
      };
    });

    const menuDataStructure = {
      cuisines: cuisinesData,
    };

    console.log("📊 Built nested menu data structure (Manager-specific):", {
      embedToken: embedToken ? `${embedToken.substring(0, 8)}...` : "none",
      cuisinesCount: cuisinesData.length,
      totalMenusCount: cuisinesData.reduce((sum, c) => sum + c.menus.length, 0),
      totalMenuItemsCount: cuisinesData.reduce((sum, c) => 
        sum + c.menus.reduce((menuSum: number, m: any) => menuSum + m.menu_items.length, 0), 0
      ),
      structure: menuDataStructure,
    });

    return JSON.stringify(menuDataStructure, null, 2);
  };

  /**
   * Build system instruction with booking data
   */
  const buildSystemInstruction = (): string => {
    const currentDate = currentMonth || new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-11
    
    // Get all days in the current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Build monthly availability data
    const monthlyAvailability: Record<string, any> = {};
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const weekdayIndex = date.getDay(); // 0=Sunday, 6=Saturday
      // Convert to Monday=0, Sunday=6 format
      const weekdayNumber = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
      
      // Find time slots available for this weekday
      const availableTimeSlots = timeSlots?.filter(slot => 
        slot.weekdays && slot.weekdays.includes(weekdayNumber)
      ) || [];
      
      // Find events booked for this date
      const dayEvents = events?.filter(event => event.date === dateStr) || [];
      const bookedTimeSlotIds = dayEvents
        .filter(event => event.time_slot)
        .map(event => event.time_slot) as number[];
      
      // Available slots (not booked)
      const freeSlots = availableTimeSlots
        .filter(slot => !bookedTimeSlotIds.includes(slot.id))
        .map(slot => ({
          id: slot.id,
          name: slot.name,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }));
      
      // Determine status
      let status = "fully-free";
      if (availableTimeSlots.length === 0) {
        status = "no-slots";
      } else if (freeSlots.length === 0) {
        status = "fully-booked";
      } else if (freeSlots.length < availableTimeSlots.length) {
        status = "partially-booked";
      }
      
      monthlyAvailability[dateStr] = {
        date: dateStr,
        weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
        status: status,
        available_slots: freeSlots,
        total_slots: availableTimeSlots.map(slot => ({
          id: slot.id,
          name: slot.name,
          start_time: slot.start_time,
          end_time: slot.end_time,
        })),
        booked_slots: bookedTimeSlotIds.length,
      };
    }
    
    // Build comprehensive system instruction
    const systemInstruction = `You are a friendly and professional event booking assistant for an event management organization. Your role is to help customers book events through natural voice conversation.

## Your Responsibilities:
1. Help customers check date and time slot availability
2. Guide customers through the booking process
3. Collect necessary booking information (name, email, phone, number of persons, date, time slot)
4. Provide clear, concise, and helpful responses
5. Be conversational and friendly

## Current Month Booking Availability:
The following data shows the booking availability for ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.

IMPORTANT: When a user asks about availability for a specific date, check this data and provide accurate information about:
- Whether the date is available (fully-free, partially-booked, or fully-booked)
- Which time slots are available for that date
- The time ranges for each available slot

### Monthly Availability Data (JSON):
${JSON.stringify(monthlyAvailability, null, 2)}

## Available Cuisines, Menus, and Menu Items:
The following data shows all available cuisines, menus, and menu items offered by this manager/admin.

**CRITICAL**: 
- This data is specific to the manager/admin who provided the embed code (identified by embed_token)
- **ONLY** mention cuisines, menus, or menu items that are present in the provided data
- **NEVER** mention or suggest anything that is not in the provided data
- Use the **EXACT** names as they appear in the data - do not add, modify, abbreviate, or paraphrase names

### Data Structure:
The data is organized in a nested hierarchical structure:
- **cuisines**: Array of cuisine objects, each containing:
  - cuisine_id: ID to use when booking (REQUIRED for booking)
  - cuisine_name: Exact name of the cuisine
  - cuisine_price: Fixed price per person (null if no fixed price set)
  - menus: Array of menu objects for this cuisine, each containing:
    - menu_id: ID of the menu category
    - menu_name: Exact name of the menu category
    - menu_items: Array of menu items in this menu, each containing:
      - menu_item_id: ID to use when booking (REQUIRED for booking)
      - menu_item_name: Exact name of the menu item
      - menu_item_price: Price for this item (only shown if cuisine doesn't have fixed price, otherwise null)

### How to Use This Nested Data Structure:

**When user asks about cuisines:**
- Iterate through the "cuisines" array
- List ONLY the exact "cuisine_name" values as they appear in the data
- Example: "We offer [cuisine_name], [cuisine_name], [cuisine_name]"
- Do NOT add words like "cuisine", "type", etc. - just use the exact names

**When user selects a cuisine:**
- Find the cuisine object in the "cuisines" array where cuisine_id or cuisine_name matches
- Access the menus array within that cuisine object
- Show ONLY the menus that exist in that cuisine's menus array
- Use exact "menu_name" values from cuisine.menus[].menu_name

**When user asks about menu items for a selected cuisine:**
- Navigate to the selected cuisine's menus array
- For each menu in cuisine.menus[], show the menu name followed by its items
- Access menu.menu_items[] to get the items for that menu
- Use exact "menu_item_name" values from menu.menu_items[].menu_item_name
- Format: "Under [menu_name], we have [menu_item_name], [menu_item_name], etc."

**CRITICAL RULES:**
- Always use EXACT names from the data - no modifications, abbreviations, or additions
- When mentioning a cuisine, use the exact "cuisine_name" value
- When mentioning a menu, use the exact "menu_name" value
- When mentioning a menu item, use the exact "menu_item_name" value
- Do NOT add words like "cuisine", "menu", "item", "dish" unless they are part of the actual name in the data
- Example: If cuisine_name is "ITALIAN CUISINE", say "ITALIAN CUISINE" - do NOT say "Italian cuisine type" or "Italian"
- **IMPORTANT**: Always use IDs (cuisine_id, menu_item_id) when calling the book_event function, NOT names

### Menu Data (JSON):
${buildMenuData()}

## Guidelines:
- Always use the provided monthly availability data to answer availability questions
- Be specific about which time slots are available when asked
- If a date is fully booked, suggest alternative dates with availability
- **CRITICAL**: Use EXACT names from the menu data - cuisines, menus, and menu items
- When mentioning any cuisine, menu, or menu item, use the EXACT name from the data without adding extra words
- Keep responses natural and conversational while using exact names
- Be helpful and patient

## Booking Process Guidelines:

### Step-by-Step Cuisine and Menu Selection Process:

**STEP 1: Confirm Cuisine First**
- First, ask the user to select a cuisine from the available options
- List all available cuisines using their exact "cuisine_name" values from the "cuisines" array
- Wait for the user to confirm their cuisine choice
- Once cuisine is confirmed, remember that ALL subsequent menu items MUST be from this same cuisine

**STEP 2: Show Available Menus for Selected Cuisine**
- After cuisine is confirmed, navigate to that cuisine object in the "cuisines" array
- Access the menus array within the selected cuisine object
- Show ONLY the menu names from cuisine.menus[].menu_name
- Use exact "menu_name" values as they appear in the nested structure
- Example: "For [cuisine_name], we have the following menus: [menu_name], [menu_name], etc."

**STEP 3: Show Menu Items with Their Menus**
- Navigate to the selected cuisine's menus array
- For each menu in cuisine.menus[], show the menu name followed by its menu items
- Access menu.menu_items[] to get the items for that menu
- Use exact "menu_item_name" values from menu.menu_items[].menu_item_name
- Format: "Under [menu_name], we have [menu_item_name], [menu_item_name], etc."
- All items shown are automatically from the selected cuisine (they're nested under it)

**STEP 4: Menu Item Selection Constraints**
- **CRITICAL CONSTRAINT 1**: Once a cuisine is selected, the user can ONLY select menu items from that same cuisine
- Since menu items are nested under cuisines, only show items from selected_cuisine.menus[].menu_items[]
- If user tries to select a menu item from a different cuisine, politely inform them: "I'm sorry, but all menu items must be from the same cuisine. You've already selected items from [selected cuisine name]. Would you like to continue with [selected cuisine name] or change to a different cuisine?"
- **CRITICAL CONSTRAINT 2**: User can select ONLY ONE menu item per menu (menu = menu category)
- Track selected items by their menu_id (from menu.menu_id)
- If user tries to select a second item from the same menu, politely inform them: "I'm sorry, but you can only select one item per menu category. You've already selected [first item name] from [menu name]. Would you like to replace it with [new item name]?"
- To check if a menu already has a selected item, verify if any selected item's menu_id matches the new item's menu

### Collecting All Booking Information:
1. Collect all required details: customer_name, customer_email, customer_contact, customer_address (optional), number_of_persons, date, time_slot (use time slot ID), cuisine (use cuisine ID), selected_menus (array of menu item IDs), extras (array of extra names - optional)

2. BEFORE confirming booking, you MUST:
   - Fully describe ALL booking details to the user (name, email, phone, address, event date, time slot, number of persons, cuisine, selected menu items with their menu names, extras if any)
   - When describing cuisine and menu items, use EXACT names from the data without adding extra words
   - Show selected menu items grouped by their menu names (navigate through the nested structure to get menu names)
   - Calculate and tell the user about the PRICE:
     * Navigate to the selected cuisine in the "cuisines" array
     * Check if cuisine.cuisine_price is not null - if so, use that: Total = (cuisine_price × number_of_persons)
     * If cuisine.cuisine_price is null, find each selected menu item in the nested structure and sum their menu_item_price values (only items where menu_item_price is not null)
   - About EXTRAS: If the user requests any extras, clearly tell them: "Extra charges for the requested extras will be added by our booking manager, and they will contact you separately to discuss the pricing for these additional services."
   - Verify that all selected menu items belong to the confirmed cuisine (they should all be found within selected_cuisine.menus[].menu_items[])
   - Verify that no two selected menu items share the same menu_id (one item per menu)

3. Only proceed with booking when user explicitly confirms (says "yes", "confirm", "book it", etc.)

### When User Confirms Booking:
When the user confirms the booking and you have collected ALL required information, you MUST call the **book_event** function with all the collected details.

IMPORTANT: 
- Call the book_event function ONLY when the user explicitly confirms they want to proceed with the booking
- Include ALL required fields in the function call
- Use IDs (numbers) for time_slot, cuisine, and selected_menus (not names)
- Use time slot ID from the availability data
- Use cuisine ID from the menu data
- Use menu item IDs from the menu data
- **VERIFY** before calling the function:
  * All selected menu items belong to the selected cuisine (can be found in selected_cuisine.menus[].menu_items[])
  * No two selected menu items have the same menu_id (only one item per menu)
  * Use cuisine_id from the selected cuisine object
  * Use menu_item_id from each selected menu item (from menu.menu_items[].menu_item_id)
- Extras should be an array of strings (names only, not IDs)
- If customer_address is not provided, use empty string ""
- If extras are not requested, use empty array []
- After calling the function, inform the user that their booking details are being reviewed`;

    return systemInstruction;
  };

  /**
   * Handle booking confirmation and create booking
   */
  const handleBookingConfirmation = async (bookingData: any) => {
    try {
      setIsSubmittingBooking(true);
      setStatus("Creating booking...");
      
      // Prepare booking payload
      const extrasWithCharges = (bookingData.extras || []).map((extra: any) => ({
        name: extra,
        charges: 0 // Booking manager will set charges
      }));

      const bookingPayload = {
        customer_name: bookingData.customer_name,
        customer_contact: bookingData.customer_contact,
        customer_email: bookingData.customer_email,
        customer_address: bookingData.customer_address || "",
        name: bookingData.event_name || "Event",
        date: bookingData.date,
        time_slot: parseInt(String(bookingData.time_slot)),
        number_of_persons: parseInt(String(bookingData.number_of_persons)) || 1,
        selected_menus: Array.isArray(bookingData.selected_menus) 
          ? bookingData.selected_menus.map((id: any) => parseInt(String(id)))
          : [],
        extras: extrasWithCharges,
        additional_charges: 0,
        cuisine: bookingData.cuisine ? parseInt(String(bookingData.cuisine)) : undefined,
        embed_token: embedToken || undefined,
      };

      console.log("📝 Creating booking with payload:", JSON.stringify(bookingPayload, null, 2));

      // Create booking via API
      let result;
      try {
        result = await apiClient.bookPublicEvent(bookingPayload);
        console.log("✅✅✅ Booking created successfully:", JSON.stringify(result, null, 2));
      } catch (apiError: any) {
        console.error("❌❌❌ API Error details:", {
          message: apiError.message,
          stack: apiError.stack,
          response: (apiError as any).response
        });
        throw apiError;
      }

      // Speak success message
      const successMessage = "Great! Your booking has been submitted successfully. It is pending approval, and our team will contact you soon to confirm the details.";
      
      // Use browser TTS to speak success message
      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(successMessage);
      utterance.rate = 1.0;
      const voices = synthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Google") || v.name.includes("Natural")) ||
                            voices.find(v => v.lang.startsWith("en")) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      
      await new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synthesis.speak(utterance);
      });
      
      setStatus("Booking confirmed!");
      setShowBookingConfirmation(false);
      setPendingBookingData(null);
      
      // Store confirmed booking data and show success modal
      setConfirmedBookingData(result);
      setShowSuccessModal(true);
      
      // Don't close voice chat immediately - let user see the confirmation

    } catch (err: any) {
      console.error("❌ Error creating booking:", err);
      const errorMessage = `Sorry, there was an error creating your booking: ${err.message || "Unknown error"}. Please try again or contact support.`;
      
      // Speak error message
      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(errorMessage);
      utterance.rate = 1.0;
      const voices = synthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Google") || v.name.includes("Natural")) ||
                            voices.find(v => v.lang.startsWith("en")) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      
      await new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synthesis.speak(utterance);
      });
      
      setError(`Booking error: ${err.message || "Unknown error"}`);
      setStatus("Error - Please try again");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  /**
   * Handle user confirming the booking from modal
   */
  const handleConfirmBooking = async () => {
    if (!pendingBookingData) {
      console.error("❌ No pending booking data to confirm");
      return;
    }
    console.log("👤 User confirmed booking with data:", JSON.stringify(pendingBookingData, null, 2));
    setShowBookingConfirmation(false);
    await handleBookingConfirmation(pendingBookingData);
    setPendingBookingData(null);
  };

  /**
   * Handle user rejecting the booking from modal
   */
  const handleRejectBooking = () => {
    setShowBookingConfirmation(false);
    setPendingBookingData(null);
    setStatus("Booking cancelled. You can continue the conversation.");
    // Resume listening
    if (isMountedRef.current && !isRecordingRef.current && sessionRef.current) {
      setTimeout(() => {
        startRecording();
      }, 500);
    }
  };

  /**
   * Format booking data for display
   */
  const formatBookingForDisplay = (data: any) => {
    if (!data) return null;

    // Find cuisine name
    const cuisine = cuisines?.find((c: any) => c.id === data.cuisine);
    const cuisineName = cuisine?.name || `Cuisine ID: ${data.cuisine}`;

    // Find time slot name
    const timeSlot = timeSlots?.find((ts: any) => ts.id === data.time_slot);
    const timeSlotName = timeSlot ? `${timeSlot.name} (${timeSlot.start_time} - ${timeSlot.end_time})` : `Time Slot ID: ${data.time_slot}`;

    // Find menu item names
    const menuNames: string[] = [];
    if (data.selected_menus && Array.isArray(data.selected_menus)) {
      data.selected_menus.forEach((menuId: number) => {
        const menuItem = subItems?.find((item: any) => item.id === menuId);
        if (menuItem) {
          menuNames.push(menuItem.name);
        } else {
          menuNames.push(`Menu ID: ${menuId}`);
        }
      });
    }

    // Calculate price
    let estimatedPrice = "To be calculated";
    if (cuisine) {
      const cuisinePrice = cuisine.price ? parseFloat(String(cuisine.price)) : null;
      if (cuisinePrice) {
        estimatedPrice = `${(cuisinePrice * (data.number_of_persons || 1)).toFixed(2)} (${cuisinePrice} per person × ${data.number_of_persons || 1} persons)`;
      } else if (menuNames.length > 0) {
        // Calculate from menu items if available
        let total = 0;
        data.selected_menus.forEach((menuId: number) => {
          const menuItem = subItems?.find((item: any) => item.id === menuId);
          if (menuItem && menuItem.price) {
            total += parseFloat(String(menuItem.price));
          }
        });
        if (total > 0) {
          estimatedPrice = `${total.toFixed(2)} (sum of selected menu items)`;
        }
      }
    }

    return {
      customerName: data.customer_name || "Not provided",
      customerEmail: data.customer_email || "Not provided",
      customerContact: data.customer_contact || "Not provided",
      customerAddress: data.customer_address || "Not provided",
      eventName: data.event_name || "Event",
      date: data.date || "Not provided",
      timeSlot: timeSlotName,
      numberOfPersons: data.number_of_persons || 1,
      cuisine: cuisineName,
      selectedMenus: menuNames.length > 0 ? menuNames : ["No menus selected"],
      extras: data.extras && Array.isArray(data.extras) && data.extras.length > 0 ? data.extras : ["None"],
      estimatedPrice: estimatedPrice,
    };
  };

  /**
   * Initialize Gemini Live API client and session
   */
  const initializeGeminiLive = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error("Gemini API key not found. Please set NEXT_PUBLIC_GEMINI_API_KEY in .env.local");
      }

      // Initialize client
      clientRef.current = new GoogleGenAI({
        apiKey: apiKey,
      });

      // Initialize audio contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      // Create gain nodes
      inputNodeRef.current = inputAudioContextRef.current.createGain();
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);

      // Initialize next start time for audio playback
      nextStartTimeRef.current = outputAudioContextRef.current.currentTime;

      // Connect to Gemini Live API
      const model = 'gemini-2.5-flash-native-audio-preview-09-2025';
      
      // Build system instruction with booking data
      const systemInstructionText = buildSystemInstruction();
      
      sessionRef.current = await clientRef.current.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            if (!isMountedRef.current) return;
            console.log("✅ Gemini Live API connection opened");
            setStatus("Ready");
            setError("");
            // Auto-start listening when connection is ready
            setTimeout(() => {
              if (isMountedRef.current && !isRecordingRef.current) {
                startRecording();
              }
            }, 500);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!isMountedRef.current) return;

            // DEBUG: Log the entire message structure to understand what we're receiving
            console.log("📨 Full message from Gemini:", JSON.stringify(message, null, 2));

            // Check for function calls (Function Calling approach)
            // Function calls can come in two formats:
            // 1. message.toolCall.functionCalls[] (primary format - what we're seeing)
            // 2. message.serverContent.modelTurn.parts[].functionCall (fallback format)
            
            let functionCall: any = null;
            
            // Method 1: Check toolCall.functionCalls (primary format - this is what we're receiving)
            if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
              functionCall = message.toolCall.functionCalls.find(
                (fc: any) => fc.name === "book_event"
              );
              if (functionCall) {
                console.log("📋 Found function call in toolCall.functionCalls:", functionCall);
              }
            }
            
            // Method 2: Check modelTurn.parts (fallback format)
            if (!functionCall && message.serverContent?.modelTurn?.parts) {
              const partWithFunctionCall = message.serverContent.modelTurn.parts.find(
                (part: any) => part.functionCall && part.functionCall.name === "book_event"
              );
              if (partWithFunctionCall) {
                functionCall = partWithFunctionCall.functionCall;
                console.log("📋 Found function call in modelTurn.parts:", functionCall);
              }
            }

            if (functionCall && functionCall.name === "book_event" && functionCall.args) {
              console.log("✅✅✅ Function call received: book_event");
              console.log("📋 Function arguments:", functionCall.args);
              
              try {
                // Extract booking data from function call arguments
                const args = functionCall.args;
                const bookingData = {
                  booking_confirmed: true,
                  customer_name: args.customer_name,
                  customer_email: args.customer_email,
                  customer_contact: args.customer_contact,
                  customer_address: args.customer_address || "",
                  event_name: args.event_name,
                  date: args.date,
                  time_slot: args.time_slot,
                  number_of_persons: args.number_of_persons,
                  cuisine: args.cuisine,
                  selected_menus: args.selected_menus || [],
                  extras: args.extras || [],
                };

                console.log("✅✅✅ Booking data extracted from function call:", bookingData);

                // Store booking data and show confirmation modal
                setPendingBookingData(bookingData);
                setShowBookingConfirmation(true);
                setStatus("Please review and confirm booking details");
                
                // Stop listening while showing confirmation
                if (isRecordingRef.current) {
                  stopRecording();
                }

                // Note: Function response will be sent after user confirms booking
                // For now, we just show the modal and wait for user confirmation

                return; // Don't process audio if booking function was called
              } catch (err: any) {
                console.error("❌ Error processing function call:", err);
                setError(`Error processing booking: ${err.message}`);
              }
            }

            // Handle audio response from Gemini
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;

            if (audio && audio.data && outputAudioContextRef.current && outputNodeRef.current) {
              setIsSpeaking(true);
              setIsListening(false); // Stop listening while speaking

              try {
                // Schedule audio playback
                const audioContext = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current,
                  audioContext.currentTime,
                );

                // Decode audio data
                const audioBuffer = await decodeAudioData(
                  decode(audio.data),
                  audioContext,
                  24000,
                  1,
                );

                // Create and play audio source
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNodeRef.current);

                source.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(source);
                  // Resume listening after all audio finishes
                  if (audioSourcesRef.current.size === 0) {
                    setIsSpeaking(false);
                    // Auto-resume listening (recording continues automatically via Live API)
                    setIsListening(true);
                    setStatus("Listening...");
                  }
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
                audioSourcesRef.current.add(source);
              } catch (err: any) {
                console.error("Error playing audio:", err);
                setError(`Audio playback error: ${err.message}`);
                setIsSpeaking(false);
                setIsListening(true);
              }
            }

            // Handle interruption (user spoke while AI was speaking)
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              // Stop all playing audio
              for (const source of audioSourcesRef.current.values()) {
                source.stop();
                audioSourcesRef.current.delete(source);
              }
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              setIsListening(true);
              setStatus("Listening...");
              // Ensure we're still recording
              if (isMountedRef.current && !isRecordingRef.current && sessionRef.current) {
                startRecording();
              }
            }
          },
          onerror: (e: ErrorEvent) => {
            if (!isMountedRef.current) return;
            console.error("Gemini Live API error:", e);
            setError(`Connection error: ${e.message}`);
            setStatus("Error - Please try again");
          },
          onclose: (e: CloseEvent) => {
            if (!isMountedRef.current) return;
            console.log("Gemini Live API connection closed:", e.reason);
            setStatus(`Connection closed: ${e.reason}`);
            setIsListening(false);
            setIsSpeaking(false);
          },
        },
        config: {
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          },
          responseModalities: [Modality.AUDIO], // Audio only - use Function Calling for structured data
          tools: [
            {
              functionDeclarations: [
                {
                  name: "book_event",
                  description: "Book an event with all collected customer and event details. Call this function when the user confirms they want to proceed with the booking.",
                  parameters: {
                    type: "OBJECT" as any,
                    properties: {
                      customer_name: {
                        type: "STRING" as any,
                        description: "Full name of the customer booking the event"
                      },
                      customer_email: {
                        type: "STRING" as any,
                        description: "Email address of the customer"
                      },
                      customer_contact: {
                        type: "STRING" as any,
                        description: "Phone number or contact information of the customer"
                      },
                      customer_address: {
                        type: "STRING" as any,
                        description: "Address of the customer (optional, can be empty string)"
                      },
                      event_name: {
                        type: "STRING" as any,
                        description: "Name or type of the event (e.g., 'Birthday Party', 'Wedding', 'Corporate Event')"
                      },
                      date: {
                        type: "STRING" as any,
                        description: "Event date in YYYY-MM-DD format"
                      },
                      time_slot: {
                        type: "INTEGER" as any,
                        description: "ID of the selected time slot (use the time slot ID from the availability data)"
                      },
                      number_of_persons: {
                        type: "INTEGER" as any,
                        description: "Number of people attending the event"
                      },
                      cuisine: {
                        type: "INTEGER" as any,
                        description: "ID of the selected cuisine (use the cuisine ID from the menu data)"
                      },
                      selected_menus: {
                        type: "ARRAY" as any,
                        items: {
                          type: "INTEGER" as any
                        },
                        description: "Array of menu item IDs that the customer selected"
                      },
                      extras: {
                        type: "ARRAY" as any,
                        items: {
                          type: "STRING" as any
                        },
                        description: "Array of extra services requested (e.g., ['DJ Service', 'Decoration'])"
                      }
                    },
                    required: [
                      "customer_name",
                      "customer_email",
                      "customer_contact",
                      "event_name",
                      "date",
                      "time_slot",
                      "number_of_persons",
                      "cuisine",
                      "selected_menus"
                    ]
                  }
                }
              ]
            }
          ],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Orus' } },
          },
        },
      });

      console.log("✅ Gemini Live API session initialized");
    } catch (err: any) {
      console.error("Error initializing Gemini Live API:", err);
      setError(`Initialization error: ${err.message}`);
      setStatus("Failed to initialize");
    }
  };

  /**
   * Start recording audio and send to Gemini Live API
   */
  const startRecording = async () => {
    if (isRecordingRef.current || !sessionRef.current || !inputAudioContextRef.current) {
      return;
    }

    try {
      setStatus("Requesting microphone access...");
      setIsListening(true);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      mediaStreamRef.current = stream;

      // Resume audio context (required for some browsers)
      await inputAudioContextRef.current.resume();

      // Create media stream source
      const sourceNode = inputAudioContextRef.current.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;
      sourceNode.connect(inputNodeRef.current!);

      // Create script processor for audio capture
      const bufferSize = 256;
      const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        if (!isRecordingRef.current || !sessionRef.current) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        // Send audio data to Gemini Live API
        try {
          sessionRef.current.sendRealtimeInput({ media: createBlob(pcmData) });
        } catch (err: any) {
          console.error("Error sending audio data:", err);
        }
      };

      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current.destination);

      scriptProcessorNodeRef.current = scriptProcessor;
      isRecordingRef.current = true;

      setStatus("🎤 Listening...");
      console.log("✅ Audio capture started");
    } catch (err: any) {
      console.error("Error starting recording:", err);
      setError(`Microphone error: ${err.message}`);
      setStatus("Failed to access microphone");
      setIsListening(false);
      stopRecording();
    }
  };

  /**
   * Stop recording audio
   */
  const stopRecording = () => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;

    // Disconnect script processor
    if (scriptProcessorNodeRef.current && sourceNodeRef.current && inputAudioContextRef.current) {
      scriptProcessorNodeRef.current.disconnect();
      sourceNodeRef.current.disconnect();
      scriptProcessorNodeRef.current = null;
      sourceNodeRef.current = null;
    }

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setStatus("Stopped");
    console.log("🛑 Audio capture stopped");
  };

  /**
   * Initialize on mount
   */
  useEffect(() => {
    isMountedRef.current = true;
    initializeGeminiLive();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;

      // Stop recording
      stopRecording();

      // Stop all audio playback
      for (const source of audioSourcesRef.current.values()) {
        source.stop();
        audioSourcesRef.current.delete(source);
      }

      // Close session
      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch (err) {
          console.error("Error closing session:", err);
        }
        sessionRef.current = null;
      }

      // Close audio contexts
      if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
      }
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <style jsx>{`
        @keyframes glow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        @keyframes glow-ring {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }
      `}</style>
      <div
        className="relative rounded-lg shadow-xl p-6 max-w-xl w-full"
        style={{ backgroundColor: "#1a1a1a" }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-800 transition-colors"
        style={{ color: "#ffffff" }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Voice Status Indicator with Wave Visualization */}
      <div className="flex flex-col items-center justify-center py-6 mb-6">
        {/* Wave Visualization with Glow Effect */}
        <div className="w-full max-w-md mb-4 relative">
          <WaveVisualization
            inputNode={inputNodeRef.current}
            outputNode={outputNodeRef.current}
            isListening={isListening}
            isSpeaking={isSpeaking}
            containerBg="#1a1a1a"
          />
          {/* Glowing wave overlay effect */}
          {(isListening || isSpeaking) && (
            <div
              className={`absolute inset-0 rounded-lg blur-xl opacity-60 transition-opacity duration-300 ${
                isListening
                  ? "bg-blue-500/50"
                  : "bg-green-500/50"
              }`}
              style={{
                animation: "glow 2s ease-in-out infinite",
              }}
            />
          )}
        </div>

        {/* Microphone/Speaker Icon with Glow */}
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 relative ${
            isListening
              ? "bg-blue-500 shadow-lg shadow-blue-500/50"
              : isSpeaking
              ? "bg-green-500 shadow-lg shadow-green-500/50"
              : "bg-gray-700"
          }`}
        >
          {/* Glowing ring effect */}
          {(isListening || isSpeaking) && (
            <div
              className={`absolute inset-0 rounded-full blur-md ${
                isListening
                  ? "bg-blue-500/50"
                  : "bg-green-500/50"
              }`}
              style={{ animation: "glow-ring 2s ease-in-out infinite" }}
            />
          )}
          {isSpeaking ? (
            <Volume2
              className={`w-12 h-12 transition-transform duration-300 text-white scale-110 relative z-10`}
            />
          ) : (
            <Mic
              className={`w-12 h-12 transition-transform duration-300 ${
                isListening ? "text-white scale-110 relative z-10" : "text-gray-400 relative z-10"
              }`}
            />
          )}
        </div>
      </div>

      {/* Success Confirmation Modal - Shows after booking is created */}
      {showSuccessModal && confirmedBookingData && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 flex flex-col max-h-[90vh]"
            style={{ backgroundColor: "#1a1a1a", color: "#ffffff" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="p-6 pb-4 border-b border-gray-700 flex-shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: "#ffffff" }}>
                  ✅ Booking Confirmed!
                </h3>
                <p className="text-sm opacity-70" style={{ color: "#ffffff" }}>
                  Your booking has been submitted successfully
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setConfirmedBookingData(null);
                  // Close voice chat after closing success modal
                  setTimeout(() => {
                    if (isMountedRef.current) {
                      onClose();
                    }
                  }, 300);
                }}
                className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                style={{ color: "#ffffff" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div 
              className="flex-1 overflow-y-auto p-6 pt-4"
              style={{ 
                minHeight: '200px',
                maxHeight: 'calc(90vh - 180px)'
              }}
            >
              {(() => {
                const formatted = formatBookingForDisplay(confirmedBookingData);
                if (!formatted) return <p style={{ color: "#ffffff" }}>Error formatting booking data</p>;

                return (
                  <div className="space-y-6">
                    {/* Event Details */}
                    <div>
                      <h4 className="text-lg font-semibold mb-3" style={{ color: "#ffffff" }}>Event Details</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="opacity-70" style={{ color: "#ffffff" }}>Event Name:</span>
                          <span className="font-medium" style={{ color: "#ffffff" }}>{formatted.eventName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70" style={{ color: "#ffffff" }}>Date:</span>
                          <span className="font-medium" style={{ color: "#ffffff" }}>{formatted.date}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70" style={{ color: "#ffffff" }}>Time:</span>
                          <span className="font-medium" style={{ color: "#ffffff" }}>{formatted.timeSlot}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70" style={{ color: "#ffffff" }}>Number of Persons:</span>
                          <span className="font-medium" style={{ color: "#ffffff" }}>{formatted.numberOfPersons}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70" style={{ color: "#ffffff" }}>Cuisine:</span>
                          <span className="font-medium" style={{ color: "#ffffff" }}>{formatted.cuisine}</span>
                        </div>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div>
                      <h4 className="text-lg font-semibold mb-3" style={{ color: "#ffffff" }}>Customer Information</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="opacity-70" style={{ color: "#ffffff" }}>Name:</span>
                          <span className="font-medium" style={{ color: "#ffffff" }}>{formatted.customerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70" style={{ color: "#ffffff" }}>Email:</span>
                          <span className="font-medium" style={{ color: "#ffffff" }}>{formatted.customerEmail}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70" style={{ color: "#ffffff" }}>Contact:</span>
                          <span className="font-medium" style={{ color: "#ffffff" }}>{formatted.customerContact}</span>
                        </div>
                        {formatted.customerAddress && formatted.customerAddress !== "Not provided" && (
                          <div className="flex justify-between">
                            <span className="opacity-70" style={{ color: "#ffffff" }}>Address:</span>
                            <span className="font-medium text-right max-w-[60%]" style={{ color: "#ffffff" }}>{formatted.customerAddress}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected Menus */}
                    {formatted.selectedMenus && formatted.selectedMenus.length > 0 && formatted.selectedMenus[0] !== "No menus selected" && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3" style={{ color: "#ffffff" }}>Selected Menu Items</h4>
                        <div className="space-y-2">
                          {formatted.selectedMenus.map((menu: string, index: number) => (
                            <div key={index} className="flex items-center">
                              <span className="text-green-400 mr-2">•</span>
                              <span style={{ color: "#ffffff" }}>{menu}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extras */}
                    {formatted.extras && formatted.extras.length > 0 && formatted.extras[0] !== "None" && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3" style={{ color: "#ffffff" }}>Extras</h4>
                        <div className="space-y-2">
                          {formatted.extras.map((extra: any, index: number) => {
                            const extraName = typeof extra === 'string' ? extra : (extra.name || 'Extra');
                            return (
                              <div key={index} className="flex items-center">
                                <span className="text-yellow-400 mr-2">•</span>
                                <span style={{ color: "#ffffff" }}>{extraName}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Estimated Price */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold" style={{ color: "#ffffff" }}>Estimated Price:</span>
                        <span className="text-xl font-bold text-green-400">{formatted.estimatedPrice}</span>
                      </div>
                    </div>

                    {/* Status Note */}
                    <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                      <p className="text-sm" style={{ color: "#ffffff" }}>
                        <strong>Status:</strong> Your booking is pending approval. Our team will contact you soon to confirm the details.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Fixed Action Button */}
            <div 
              className="flex justify-end p-6 pt-4 border-t border-gray-700 flex-shrink-0"
              style={{ 
                backgroundColor: "#1a1a1a",
              }}
            >
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setConfirmedBookingData(null);
                  // Close voice chat after closing success modal
                  setTimeout(() => {
                    if (isMountedRef.current) {
                      onClose();
                    }
                  }, 300);
                }}
                className="px-6 py-2 rounded-lg font-medium transition-colors bg-green-500 text-white hover:bg-green-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Confirmation Modal - Shows before booking is created */}
      {showBookingConfirmation && pendingBookingData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 flex flex-col max-h-[90vh]"
            style={{ backgroundColor: containerBg }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="p-6 pb-4 border-b flex-shrink-0">
              <h3 className="text-2xl font-bold mb-2" style={{ color: textColor }}>
                Review Booking Details
              </h3>
              <p className="text-sm opacity-70" style={{ color: textColor }}>
                Please review all details before confirming your booking:
              </p>
            </div>

            {/* Scrollable Content - with proper height constraints to ensure buttons are visible */}
            <div 
              className="flex-1 overflow-y-auto p-6 pt-4"
              style={{ 
                minHeight: '200px',
                maxHeight: 'calc(90vh - 180px)' // Reserve space for header (~100px) and buttons (~80px)
              }}
            >
              {(() => {
                const formatted = formatBookingForDisplay(pendingBookingData);
                if (!formatted) return <p>Error formatting booking data</p>;

                return (
                  <div className="space-y-4">
                  {/* Customer Information */}
                  <div className="border-b pb-4">
                    <h4 className="font-semibold mb-2 text-lg" style={{ color: textColor }}>
                      Customer Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium opacity-70">Name:</span>
                        <p className="mt-1">{formatted.customerName}</p>
                      </div>
                      <div>
                        <span className="font-medium opacity-70">Email:</span>
                        <p className="mt-1">{formatted.customerEmail}</p>
                      </div>
                      <div>
                        <span className="font-medium opacity-70">Contact:</span>
                        <p className="mt-1">{formatted.customerContact}</p>
                      </div>
                      <div>
                        <span className="font-medium opacity-70">Address:</span>
                        <p className="mt-1">{formatted.customerAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Event Details */}
                  <div className="border-b pb-4">
                    <h4 className="font-semibold mb-2 text-lg" style={{ color: textColor }}>
                      Event Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium opacity-70">Event Name:</span>
                        <p className="mt-1">{formatted.eventName}</p>
                      </div>
                      <div>
                        <span className="font-medium opacity-70">Date:</span>
                        <p className="mt-1">{formatted.date}</p>
                      </div>
                      <div>
                        <span className="font-medium opacity-70">Time Slot:</span>
                        <p className="mt-1">{formatted.timeSlot}</p>
                      </div>
                      <div>
                        <span className="font-medium opacity-70">Number of Persons:</span>
                        <p className="mt-1">{formatted.numberOfPersons}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Details */}
                  <div className="border-b pb-4">
                    <h4 className="font-semibold mb-2 text-lg" style={{ color: textColor }}>
                      Menu Selection
                    </h4>
                    <div className="text-sm">
                      <div className="mb-2">
                        <span className="font-medium opacity-70">Cuisine:</span>
                        <p className="mt-1">{formatted.cuisine}</p>
                      </div>
                      <div className="mb-2">
                        <span className="font-medium opacity-70">Selected Menu Items:</span>
                        <ul className="mt-1 list-disc list-inside">
                          {formatted.selectedMenus.map((menu, idx) => (
                            <li key={idx}>{menu}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium opacity-70">Extras:</span>
                        <ul className="mt-1 list-disc list-inside">
                          {formatted.extras.map((extra: string, idx: number) => (
                            <li key={idx}>{extra}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Price Estimate */}
                  <div>
                    <h4 className="font-semibold mb-2 text-lg" style={{ color: textColor }}>
                      Estimated Price
                    </h4>
                    <p className="text-sm">{formatted.estimatedPrice}</p>
                    {formatted.extras.length > 0 && formatted.extras[0] !== "None" && (
                      <p className="text-xs mt-2 opacity-70 italic">
                        Note: Prices for extras will be added by the booking manager who will contact you separately.
                      </p>
                    )}
                  </div>
                </div>
              );
              })()}
            </div>

            {/* Fixed Action Buttons - Always visible at bottom */}
            <div 
              className="flex gap-3 justify-end p-6 pt-4 border-t flex-shrink-0 bg-white"
              style={{ 
                backgroundColor: containerBg,
                position: 'sticky',
                bottom: 0,
                zIndex: 10
              }}
            >
              <button
                onClick={handleRejectBooking}
                disabled={isSubmittingBooking}
                className="px-6 py-2 rounded-lg font-medium transition-colors bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={isSubmittingBooking}
                className="px-6 py-2 rounded-lg font-medium transition-colors bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingBooking ? "Submitting..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
