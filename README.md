# RSS Reader

A minimal, beautiful RSS feed reader built for self-hosting. Features a Material Design interface with dark/light themes and multiple view modes.

![image](https://github.com/user-attachments/assets/3cef771c-a301-447b-bec9-c7beed5c2e5b)

## Features

- **Single-user RSS feed reader** - No user accounts needed
- **Material Design UI** - Clean, modern interface
- **Dark/Light theme toggle** - Automatic theme persistence
- **Multiple view modes** - Compact, Summary, and Rich views
- **Auto-refresh** - Feeds update every 30 minutes
- **Responsive design** - Works on desktop and mobile
- **Docker containerized** - Easy deployment

![rss-reader-demo-01](https://github.com/user-attachments/assets/ae0a9957-2fe1-4762-9aea-0b3e5ca0e8a7)

## Quick Start

1. Clone this repository:
```bash
git clone https://github.com/PicoPixl/rss-reader
cd rss-reader
```

2. Start the application:
```bash
docker compose up -d
```

3. Open your browser and go to `http://localhost:3000`

That's it! The application will be running and ready to use.

## Usage

### Adding Feeds
- Click the **+** button in the header
- Enter the RSS feed URL
- Optionally provide a custom title
- Click "Add Feed"

### View Modes
- **Compact**: Minimal view showing just titles
- **Summary**: Shows titles with truncated descriptions
- **Rich**: Full article previews

### Managing Feeds
- Hover over feeds in the sidebar to see delete option
- Use the refresh button to manually update all feeds
- Feeds automatically refresh every 30 minutes

## Data Storage

- All data is stored in the `./data` directory
- Feed subscriptions: `./data/feeds.json`
- Article cache: `./data/articles.json`
- Data persists between container restarts

## Customization

### Port Configuration
To change the port from 3000, edit `docker-compose.yaml`:
```yaml
ports:
  - "8080:3000"  # Change 8080 to your desired port
```

### Feed Refresh Interval
To change the auto-refresh interval, edit the cron schedule in `server.js`:
```javascript
// Current: every 30 minutes
cron.schedule('*/30 * * * *', updateAllFeeds);

// Example: every hour
cron.schedule('0 * * * *', updateAllFeeds);
```

## Troubleshooting

### Container won't start
- Ensure Docker is running
- Check if port 3000 is already in use
- Run `docker compose logs` to see error messages

### Feeds not loading
- Verify the RSS feed URL is correct and accessible
- Some feeds may require specific headers or have CORS restrictions
- Check container logs: `docker compose logs rss-reader`

### Data not persisting
- Ensure the `./data` directory has proper permissions
- Check Docker volume mounting in `docker-compose.yaml`

## Development

To run in development mode:

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open `http://localhost:3000`

## Architecture

- **Backend**: Node.js with Express
- **RSS Parsing**: rss-parser library
- **Scheduling**: node-cron for auto-refresh
- **Frontend**: Vanilla JavaScript with Material Design
- **Storage**: JSON files for simplicity
- **Container**: Alpine Linux with Node.js 18

## Additional Notes

This project was mostly constructed using AI (service redacted so as to not promote anything). It was a fun learning project both in terms of working with AI to build something, as well as to get a better understanding about how Docker containers work. Hopefully it can be used by others as a simple project to self-host RSS, a learning tool for what a basic service looks like, or as a foundation for building something more elaborate. Feel free to use it for whatever you want!

## License

MIT License - feel free to modify and distribute as needed.
