# ExoMobile - ITMS Group Odoo Mobile App

A React Native mobile application for seamless access to Odoo ERP systems, built for ITMS Group. ExoMobile provides a modern, intuitive mobile interface for managing business operations on the go.

## 🚀 Features

### ✅ Current Features
- **OAuth2 Authentication** - Secure login with Odoo server integration
- **Modern UI/UX** - Clean, professional interface with ITMS Group branding
- **Contact Management** - View and manage business contacts
- **WhatsApp-style Messaging** - Intuitive message threads with attachment support
- **Offline Support** - Basic offline capabilities with data caching
- **Cross-platform** - iOS, Android, and Web support via Expo

### 🔄 In Development
- **Helpdesk Integration** - Ticket management and support workflows
- **Advanced Messaging** - Rich text, PDF previews, multi-attachments
- **Enhanced Offline Mode** - Robust sync and conflict resolution
- **Profile Management** - User profile editing and avatar management

## 🛠 Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation v6
- **State Management**: React Context + AsyncStorage
- **API Integration**: Odoo REST API v2 with OAuth2
- **UI Components**: Custom components with modern design
- **File Handling**: Expo Document Picker, Image Picker
- **Offline Storage**: AsyncStorage with sync capabilities

## 📱 Screenshots

The app features a clean, professional design with:
- Large ITMS Group logo for strong brand presence
- Intuitive login flow with advanced settings
- Modern card-based layouts
- WhatsApp-style messaging interface

## 🏗 Project Structure

```
exomobile/
├── src/
│   ├── api/                  # Odoo API integration
│   ├── components/           # Reusable UI components
│   ├── contexts/             # React contexts (Auth, Theme, etc.)
│   ├── features/             # Feature modules
│   │   ├── auth/             # Authentication screens
│   │   ├── contacts/         # Contact management
│   │   ├── helpdesk/         # Helpdesk functionality
│   │   ├── home/             # Dashboard and home screen
│   │   └── profile/          # User profile management
│   ├── navigation/           # App navigation setup
│   ├── services/             # Business logic services
│   └── utils/                # Utility functions
├── tests/                    # API tests and validation
└── docs/                     # Comprehensive documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/exomobile.git
   cd exomobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on your preferred platform**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   
   # Web
   npm run web
   ```

## ⚙️ Configuration

### Odoo Server Setup
The app connects to Odoo via REST API v2. Configure your server details in the login screen:

- **Server URL**: Your Odoo instance URL
- **Database**: Your Odoo database name
- **Authentication**: OAuth2 with username/password

### Environment Variables
Create appropriate configuration for your Odoo instance in `src/config/odoo.js`.

## 📖 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[API Guide](docs/API_GUIDE.md)** - Odoo API integration details
- **[Development Guide](docs/DEVELOPMENT.md)** - Development setup and guidelines
- **[Technical Guide](docs/TECHNICAL_GUIDE.md)** - Architecture and implementation
- **[Project Status](docs/PROJECT_STATUS.md)** - Current status and roadmap

## 🧪 Testing

The project includes comprehensive API tests for Odoo integration:

```bash
# Run API tests
cd tests/odoo_api_tests
python run_tests.py

# Run unit tests
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software developed for ITMS Group.

## 🏢 About ITMS Group

ExoMobile is developed by and for ITMS Group, providing mobile access to business operations and enhancing productivity for field teams and remote workers.

## 📞 Support

For support and questions, please contact the ITMS Group development team.



---

**Built with ❤️ for ITMS Group**
