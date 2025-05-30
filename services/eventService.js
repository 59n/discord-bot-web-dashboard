const { loadEventData, saveEventData } = require('./dataService');

class EventService {
    constructor() {
        this.events = new Map();
        this.rsvps = new Map();
        this.reminders = new Map();
    }

    async loadEventData() {
        try {
            const data = await loadEventData();
            
            if (data.events) {
                this.events = new Map(Object.entries(data.events));
            }
            
            if (data.rsvps) {
                this.rsvps = new Map(Object.entries(data.rsvps));
            }
            
            if (data.reminders) {
                this.reminders = new Map(Object.entries(data.reminders));
            }
            
            console.log('✅ Event data loaded');
        } catch (error) {
            console.log('📅 No existing event data found, starting fresh');
        }
    }

    async saveEventData() {
        try {
            const data = {
                events: Object.fromEntries(this.events),
                rsvps: Object.fromEntries(this.rsvps),
                reminders: Object.fromEntries(this.reminders),
                lastSaved: new Date().toISOString()
            };
            
            await saveEventData(data);
            console.log('💾 Event data saved');
        } catch (error) {
            console.error('❌ Failed to save event data:', error);
        }
    }

    async createEvent(eventData) {
        const eventId = `event_${Date.now()}`;
        const event = {
            id: eventId,
            title: eventData.title,
            description: eventData.description,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            location: eventData.location || 'Discord Server',
            maxAttendees: eventData.maxAttendees || null,
            guildId: eventData.guildId,
            channelId: eventData.channelId,
            createdBy: eventData.createdBy,
            createdAt: new Date().toISOString(),
            status: 'scheduled',
            attendees: [],
            maybeAttendees: [],
            notAttending: [],
            reminders: eventData.reminders || ['1h', '15m'],
            requireApproval: eventData.requireApproval || false,
            isRecurring: eventData.isRecurring || false,
            recurringPattern: eventData.recurringPattern || null
        };

        this.events.set(eventId, event);
        await this.saveEventData();
        
        // Schedule reminders
        await this.scheduleReminders(event);
        
        return event;
    }

    async rsvpToEvent(eventId, userId, response, username) {
        const event = this.events.get(eventId);
        if (!event) throw new Error('Event not found');

        // Remove user from all RSVP lists first
        event.attendees = event.attendees.filter(a => a.userId !== userId);
        event.maybeAttendees = event.maybeAttendees.filter(a => a.userId !== userId);
        event.notAttending = event.notAttending.filter(a => a.userId !== userId);

        const rsvpData = {
            userId,
            username,
            timestamp: new Date().toISOString()
        };

        // Add to appropriate list
        switch (response) {
            case 'yes':
                if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
                    throw new Error('Event is full');
                }
                event.attendees.push(rsvpData);
                break;
            case 'maybe':
                event.maybeAttendees.push(rsvpData);
                break;
            case 'no':
                event.notAttending.push(rsvpData);
                break;
        }

        this.events.set(eventId, event);
        await this.saveEventData();
        
        return event;
    }

    async scheduleReminders(event) {
        const eventTime = new Date(event.startTime);
        
        for (const reminder of event.reminders) {
            const reminderTime = this.parseReminderTime(reminder, eventTime);
            
            if (reminderTime > Date.now()) {
                const reminderId = `${event.id}_${reminder}`;
                
                this.reminders.set(reminderId, {
                    eventId: event.id,
                    reminderTime: reminderTime,
                    reminderText: reminder,
                    sent: false
                });
            }
        }
        
        await this.saveEventData();
    }

    parseReminderTime(reminder, eventTime) {
        const match = reminder.match(/^(\d+)([mhd])$/);
        if (!match) return eventTime.getTime();
        
        const [, amount, unit] = match;
        const multipliers = { m: 60000, h: 3600000, d: 86400000 };
        
        return eventTime.getTime() - (parseInt(amount) * multipliers[unit]);
    }

async checkReminders() {
    const now = Date.now();
    const dueReminders = Array.from(this.reminders.values()).filter(
        reminder => !reminder.sent && reminder.reminderTime <= now
    );

    const remindersToSend = [];

    for (const reminder of dueReminders) {
        const event = this.events.get(reminder.eventId);
        if (event) {
            // Mark as sent
            reminder.sent = true;
            this.reminders.set(`${reminder.eventId}_${reminder.reminderText}`, reminder);
            
            // Add to reminders to send array
            remindersToSend.push({
                event,
                reminderText: reminder.reminderText,
                attendees: event.attendees
            });
        }
    }
    
    await this.saveEventData();
    
    // Return all due reminders
    return remindersToSend;
}


    getUpcomingEvents(guildId, limit = 10) {
        const now = Date.now();
        return Array.from(this.events.values())
            .filter(event => 
                event.guildId === guildId && 
                new Date(event.startTime).getTime() > now &&
                event.status === 'scheduled'
            )
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
            .slice(0, limit);
    }

    getEventStats(guildId) {
        const guildEvents = Array.from(this.events.values()).filter(event => event.guildId === guildId);
        
        return {
            totalEvents: guildEvents.length,
            upcomingEvents: guildEvents.filter(e => new Date(e.startTime) > Date.now()).length,
            pastEvents: guildEvents.filter(e => new Date(e.startTime) < Date.now()).length,
            totalAttendees: guildEvents.reduce((sum, e) => sum + e.attendees.length, 0)
        };
    }
}

module.exports = new EventService();
