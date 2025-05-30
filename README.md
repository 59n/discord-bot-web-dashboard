# Discord Bot Web Dashboard 🤖

A comprehensive Discord bot management system with a modern web dashboard, featuring advanced server management, button roles, ticketing system, and real-time analytics.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18+-blue)
![Discord.js](https://img.shields.io/badge/Discord.js-14+-purple)

## ✨ Features

### 🎯 **Button Role System**
- **Custom Embeds** - Create beautiful role selection embeds with full customization
- **25 Buttons Max** - Support for up to 25 role buttons per setup
- **Visual Customization** - Hide/show elements, custom colors, thumbnails, footers
- **Custom Button Labels** - Override button text independently from role names
- **Member Count Display** - Show current role member counts on buttons
- **Duplicate Prevention** - Automatic validation to prevent role conflicts
- **Live Preview** - Real-time Discord-style embed preview
- **Redeploy & Edit** - Full CRUD operations with visual editor

### 🎫 **Advanced Ticketing System**
- **Multi-Category Support** - Organize tickets by categories
- **Staff Assignment** - Automatic and manual ticket assignment
- **Transcript Generation** - Complete conversation logs
- **Priority Levels** - Urgent, high, normal, low priority tickets
- **Custom Embeds** - Branded ticket creation messages
- **Auto-Close** - Configurable auto-close timers
- **Statistics Dashboard** - Comprehensive ticket analytics

### 🛡️ **Moderation Tools**
- **Auto-Moderation** - Spam detection, link filtering, bad word detection
- **Warning System** - Progressive punishment system
- **Temporary Actions** - Timed mutes, bans with auto-removal
- **Moderation Logs** - Complete audit trail
- **Custom Punishments** - Configurable punishment escalation

### 📊 **Analytics & Monitoring**
- **Real-time Dashboard** - Live server statistics
- **Usage Analytics** - Command usage, user activity tracking
- **Performance Metrics** - Bot uptime, response times
- **Custom Reports** - Exportable data insights

### 🔧 **Server Management**
- **Role Automation** - Activity-based and time-based role assignment
- **Event Scheduling** - Server events with RSVP system
- **Command Builder** - Custom slash commands creation
- **Security Features** - Rate limiting, input validation
- **Notification System** - Automated announcements and alerts

### 🎨 **Web Dashboard**
- **Modern UI** - Material-UI based responsive interface
- **Real-time Updates** - Socket.io integration for live data
- **Role-based Access** - Admin, moderator, and user permissions
- **Dark/Light Theme** - Customizable interface themes
- **Mobile Responsive** - Works perfectly on all devices

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Discord Bot Token
- Discord Application with Bot permissions

### Installation

1. **Clone the repository**
   ```
   git clone https://github.com/59n/discord-bot-web-dashboard.git
   cd discord-bot-web-dashboard
   ```

2. **Install dependencies**
   ```
   # Backend dependencies
   npm install
   
   # Frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Environment Configuration**
   ```
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```
   # Discord Bot Configuration
   DISCORD_TOKEN=your_bot_token_here
   
   # Server Configuration
   PORT=3000

   ```

4. **Start the application**
   ```
   # Development mode (both backend and frontend)
   npm run dev
   
   # Or start separately
   npm start              # Backend only
   cd client && npm start # Frontend only
   ```

5. **Access the dashboard**
   - Open `http://localhost:3000` in your browser
   - Login the given admin account
   - Configure your bot settings

## 📁 Project Structure

```
discord-bot-web-dashboard/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── AnalyticsPanel.js
│   │   │   ├── ButtonRolePanel.js
│   │   │   ├── CommandBuilder.js
│   │   │   ├── Dashboard.js
│   │   │   ├── TicketPanel.js
│   │   │   └── ...
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions
│   │   └── App.js          # Main app component
│   └── package.json
├── commands/               # Discord slash commands
├── handlers/               # Event and interaction handlers
│   ├── commandHandler.js
│   ├── eventHandler.js
│   ├── interactionHandler.js
│   └── moderationHandler.js
├── services/               # Business logic services
│   ├── analyticsService.js
│   ├── autoModerationService.js
│   ├── commandService.js
│   ├── dataService.js
│   ├── eventService.js
│   ├── roleAutomationService.js
│   └── ticketService.js
├── routes/                 # Express API routes
│   ├── analytics.js
│   ├── auth.js
│   ├── buttonRoles.js
│   ├── commands.js
│   ├── guilds.js
│   └── tickets.js
├── middleware/             # Express middleware
│   ├── auth.js
│   ├── rateLimiting.js
│   └── security.js
├── utils/                  # Utility functions
│   ├── helpers.js
│   └── validators.js
├── config/                 # Configuration files
│   ├── constants.js
│   └── database.js
├── data/                   # Data storage (JSON files)
├── scripts/                # Utility scripts
├── bot.js                  # Main bot file
├── server.js               # Express server
├── web-server.js           # Web server entry point
└── package.json
```

## 🎮 Usage

### Setting Up Button Roles

1. Navigate to **Button Roles** in the dashboard
2. Click **Create Setup**
3. Configure your embed:
   - Set title, description, and colors
   - Choose display options (member counts, instructions, etc.)
   - Add up to 25 buttons with custom labels
4. Select target channel and logging options
5. Click **Create & Send**

### Managing Tickets

1. Go to **Ticket Panel**
2. Configure ticket categories and settings
3. Set up staff roles and auto-assignment
4. Customize ticket creation embeds
5. Monitor tickets in real-time

### Building Custom Commands

1. Access **Command Builder**
2. Create slash commands with custom responses
3. Set permissions and cooldowns
4. Test commands in real-time
5. Deploy to your server

## 🔧 Configuration

### Bot Permissions Required
- `ADMINISTRATOR` (recommended) or specific permissions:
  - `MANAGE_ROLES`
  - `MANAGE_CHANNELS`
  - `MANAGE_MESSAGES`
  - `SEND_MESSAGES`
  - `EMBED_LINKS`
  - `ADD_REACTIONS`
  - `USE_APPLICATION_COMMANDS`

### Dashboard Access Levels
- **Admin**: Full access to all features
- **Moderator**: Access to moderation and ticket management
- **User**: Limited access to basic features

## 🛠️ Development

### Tech Stack
- **Backend**: Node.js, Express.js, Discord.js, Socket.io
- **Frontend**: React, Material-UI, Framer Motion
- **Data Storage**: JSON files (easily adaptable to databases)
- **Authentication**: JWT tokens, Discord OAuth2

### Development Commands
```
npm run dev          # Start both backend and frontend in development
npm run build        # Build frontend for production
npm test             # Run tests
```

### Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📊 API Endpoints

### Button Roles
- `GET /api/button-roles/:guildId` - Get all button role setups
- `POST /api/button-roles` - Create new button role setup
- `PUT /api/button-roles/:setupId` - Update existing setup
- `DELETE /api/button-roles/:setupId` - Delete setup
- `POST /api/button-roles/redeploy` - Redeploy to different channel

### Tickets
- `GET /api/tickets/:guildId` - Get all tickets
- `POST /api/tickets` - Create new ticket
- `PUT /api/tickets/:ticketId` - Update ticket
- `DELETE /api/tickets/:ticketId` - Close ticket

### Analytics
- `GET /api/analytics/:guildId` - Get server analytics
- `GET /api/stats` - Get bot statistics

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Role-based Access Control** - Granular permission system
- **Input Validation** - Comprehensive input sanitization
- **Rate Limiting** - API rate limiting protection
- **Secure Headers** - Security headers implementation

## 🐛 Troubleshooting

### Common Issues

**Bot not responding to commands:**
- Check bot permissions in Discord server
- Verify bot token in `.env` file
- Ensure bot is online and connected

**Dashboard not loading:**
- Check if both backend and frontend are running
- Verify port configuration
- Check browser console for errors

**Button roles not working:**
- Verify bot has `MANAGE_ROLES` permission
- Check if bot role is higher than assigned roles
- Review console logs for permission errors

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/59n/discord-bot-web-dashboard/issues)

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Discord API wrapper
- [Material-UI](https://mui.com/) - React UI framework
- [Socket.io](https://socket.io/) - Real-time communication
- [Express.js](https://expressjs.com/) - Web framework

---

**Made with ❤️ for the Discord community**

*Star ⭐ this repository if you found it helpful!*
