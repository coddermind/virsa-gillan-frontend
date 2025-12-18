"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, X } from "lucide-react";
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
   * Build simple cuisine data - only cuisine names (manager-specific)
   */
  const buildCuisineData = (): string => {
    // IMPORTANT: All cuisines are already filtered by embed_token on the backend
    // The embed_token identifies the specific manager/admin, so all data here is manager-specific
    console.log("📊 Building cuisine data (Manager-specific via embed_token):", {
      embedToken: embedToken ? `${embedToken.substring(0, 8)}...` : "none",
      cuisinesCount: cuisines?.length || 0,
    });

    // Extract only cuisine names
    const cuisineNames = cuisines && cuisines.length > 0
      ? cuisines.map((cuisine: any) => ({
          id: cuisine.id,
          name: cuisine.name,
        }))
      : [];

    const cuisineData = {
      cuisines: cuisineNames,
    };

    console.log("📋 Available cuisines for this manager:", cuisineNames.map((c: any) => c.name));

    return JSON.stringify(cuisineData, null, 2);
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

## Available Cuisines:
The following data shows all available cuisines offered by this manager/admin.

**CRITICAL**: 
- This cuisine data is specific to the manager/admin who provided the embed code (identified by embed_token)
- **ONLY** mention cuisines that are present in the provided cuisine data
- **NEVER** mention or suggest cuisines that are not in the provided data
- Use the exact cuisine names as they appear in the data

### How to Use Cuisine Data:
When users ask about available cuisines, simply list the cuisine names from the provided data.

**Example Response Format:**
If user asks "What cuisines do you offer?" or "What cuisines are available?", you should respond like:
"We offer the following cuisines:
- [Cuisine Name 1]
- [Cuisine Name 2]
- [Cuisine Name 3]
...and so on"

**CRITICAL**: 
- Use the exact cuisine names as they appear in the cuisines array
- Do not abbreviate, paraphrase, or change the names
- Only mention cuisines that are in the provided data

### Available Cuisines (JSON):
${buildCuisineData()}

## Guidelines:
- Always use the provided monthly availability data to answer availability questions
- Be specific about which time slots are available when asked
- If a date is fully booked, suggest alternative dates with availability
- When users ask about cuisines, use the cuisine data to provide accurate information
- **CRITICAL**: When asked about available cuisines, only mention cuisines that are in the provided cuisine data
- Use the exact cuisine names as they appear in the data
- Keep responses natural and conversational
- Be helpful and patient

## Booking Process Guidelines:

### Collecting Booking Information:
1. Collect all required details: customer_name, customer_email, customer_contact, customer_address (optional), number_of_persons, date, time_slot (use time slot ID), cuisine (use cuisine ID), selected_menus (array of menu item IDs), extras (array of extra names - optional)

2. BEFORE confirming booking, you MUST:
   - Fully describe ALL booking details to the user (name, email, phone, address, event date, time slot, number of persons, cuisine, selected menus, extras if any)
   - Calculate and tell the user about the PRICE:
     * If cuisine has fixed price: Total = (cuisine price_per_person × number_of_persons)
     * If cuisine has individual menu prices: Total = sum of all selected menu item prices
   - About EXTRAS: If the user requests any extras, clearly tell them: "Extra charges for the requested extras will be added by our booking manager, and they will contact you separately to discuss the pricing for these additional services."

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
      
      // Close the voice chat after a delay
      setTimeout(() => {
        if (isMountedRef.current) {
          onClose();
        }
      }, 3000);

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
    <div
      className="relative bg-white rounded-lg shadow-xl p-6 max-w-xl w-full"
      style={{ backgroundColor: containerBg }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        style={{ color: textColor }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2" style={{ color: textColor }}>
          Voice Assistant
        </h2>
        <p className="text-sm opacity-70" style={{ color: textColor }}>
          {error || status}
        </p>
      </div>

      {/* Voice Status Indicator with Wave Visualization */}
      <div className="flex flex-col items-center justify-center py-6 mb-6">
        {/* Wave Visualization */}
        <div className="w-full max-w-md mb-4">
          <WaveVisualization
            inputNode={inputNodeRef.current}
            outputNode={outputNodeRef.current}
            isListening={isListening}
            isSpeaking={isSpeaking}
            containerBg={containerBg}
          />
        </div>

        {/* Microphone Icon */}
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening
              ? "bg-blue-500 shadow-lg shadow-blue-500/50"
              : isSpeaking
              ? "bg-green-500 shadow-lg shadow-green-500/50"
              : "bg-gray-200"
          }`}
        >
          <Mic
            className={`w-12 h-12 transition-transform duration-300 ${
              isListening ? "text-white scale-110" : isSpeaking ? "text-white scale-110" : "text-gray-400"
            }`}
          />
        </div>
        <p className="mt-4 text-sm font-medium" style={{ color: textColor }}>
          {isListening
            ? "🎤 Listening..."
            : isSpeaking
            ? "🔊 Speaking..."
            : "⏸️ Ready"}
        </p>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={startRecording}
          disabled={isSpeaking || isListening || !sessionRef.current}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isSpeaking || isListening || !sessionRef.current
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {isListening ? "Listening..." : "Start Listening"}
        </button>
        <button
          onClick={stopRecording}
          disabled={isSpeaking || !isListening}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isSpeaking || !isListening
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
        >
          Stop
        </button>
      </div>

      {/* Booking Confirmation Modal */}
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
  );
}
