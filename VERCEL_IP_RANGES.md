# Vercel IP Ranges for MongoDB Atlas Configuration

This guide provides Vercel's IP ranges and instructions for configuring MongoDB Atlas to allow connections from Vercel's servers.

## Vercel IP Ranges

Vercel uses the following IP ranges for their serverless functions and edge functions:

### Primary IP Ranges:
```
76.76.19.0/24
76.76.20.0/24
76.76.21.0/24
76.76.22.0/24
76.76.23.0/24
76.76.24.0/24
76.76.25.0/24
76.76.26.0/24
76.76.27.0/24
76.76.28.0/24
76.76.29.0/24
76.76.30.0/24
76.76.31.0/24
```

### Additional IP Ranges:
```
13.107.42.0/24
13.107.43.0/24
13.107.44.0/24
13.107.45.0/24
13.107.46.0/24
13.107.47.0/24
13.107.48.0/24
13.107.49.0/24
13.107.50.0/24
13.107.51.0/24
13.107.52.0/24
13.107.53.0/24
13.107.54.0/24
13.107.55.0/24
13.107.56.0/24
13.107.57.0/24
13.107.58.0/24
13.107.59.0/24
13.107.60.0/24
13.107.61.0/24
13.107.62.0/24
13.107.63.0/24
```

## How to Configure MongoDB Atlas

### Option 1: Allow All IPs (Recommended for Development)

1. Go to your MongoDB Atlas dashboard
2. Navigate to **Network Access** in the left sidebar
3. Click **+ ADD IP ADDRESS**
4. Click **ALLOW ACCESS FROM ANYWHERE** (0.0.0.0/0)
5. Click **Confirm**

⚠️ **Note**: This is less secure but easier for development. For production, use specific IP ranges.

### Option 2: Add Vercel IP Ranges (More Secure)

1. Go to your MongoDB Atlas dashboard
2. Navigate to **Network Access** in the left sidebar
3. Click **+ ADD IP ADDRESS**
4. Add each IP range one by one:

#### Primary Ranges:
```
76.76.19.0/24
76.76.20.0/24
76.76.21.0/24
76.76.22.0/24
76.76.23.0/24
76.76.24.0/24
76.76.25.0/24
76.76.26.0/24
76.76.27.0/24
76.76.28.0/24
76.76.29.0/24
76.76.30.0/24
76.76.31.0/24
```

#### Additional Ranges:
```
13.107.42.0/24
13.107.43.0/24
13.107.44.0/24
13.107.45.0/24
13.107.46.0/24
13.107.47.0/24
13.107.48.0/24
13.107.49.0/24
13.107.50.0/24
13.107.51.0/24
13.107.52.0/24
13.107.53.0/24
13.107.54.0/24
13.107.55.0/24
13.107.56.0/24
13.107.57.0/24
13.107.58.0/24
13.107.59.0/24
13.107.60.0/24
13.107.61.0/24
13.107.62.0/24
13.107.63.0/24
```

### Option 3: Use MongoDB Atlas Data API (Alternative)

If you continue having connection issues, you can use MongoDB Atlas Data API:

1. Enable **Data API** in your MongoDB Atlas cluster
2. Use the Data API endpoint instead of direct MongoDB connection
3. Update your connection string to use the Data API

## Testing the Connection

After configuring the IP ranges, test your connection:

1. Deploy your backend to Vercel
2. Check the Vercel function logs for connection errors
3. Test your API endpoints

## Common Issues and Solutions

### Issue: "MongoNetworkError: connect ECONNREFUSED"

**Solution**: 
- Ensure you've added the correct IP ranges
- Check that your MongoDB Atlas cluster is running
- Verify your connection string is correct

### Issue: "MongoNetworkError: Server selection timed out"

**Solution**:
- Add more IP ranges from the list above
- Check if your cluster is in a different region
- Consider using "Allow access from anywhere" temporarily

### Issue: "Authentication failed"

**Solution**:
- Check your MongoDB Atlas username and password
- Ensure your database user has the correct permissions
- Verify your connection string format

## Security Best Practices

1. **For Development**: Use "Allow access from anywhere" (0.0.0.0/0)
2. **For Production**: Use specific IP ranges
3. **Regular Updates**: Check Vercel's documentation for updated IP ranges
4. **Monitor Access**: Use MongoDB Atlas logs to monitor connection attempts

## Getting Updated IP Ranges

Vercel occasionally updates their IP ranges. To get the latest:

1. Check Vercel's documentation: https://vercel.com/docs/concepts/edge-network/regions
2. Contact Vercel support
3. Use the "Allow access from anywhere" option as a fallback

## Alternative: Use MongoDB Atlas Data API

If you continue having issues with direct connections:

1. Enable Data API in MongoDB Atlas
2. Use the Data API endpoint
3. Update your connection logic to use HTTP requests instead of MongoDB driver

This approach is more reliable but requires changes to your application code.
