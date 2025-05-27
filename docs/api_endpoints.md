# API Endpoints for Mobile App

This document outlines the API endpoints required for the mobile application.

## Authentication

The API supports the following authentication methods:

- **Basic Authentication**: Username and password
- **OAuth2**: Authorization code, implicit, password, and client credentials flows

### OAuth2 Token Endpoint

```
/api/v2/authentication/oauth2/token
```

## Model Endpoints

### hr.employee

| Method   | Path                                | Purpose       |
|:---------|:------------------------------------|:--------------|
| GET      | /search_read/hr.employee            | List view     |
| GET      | /read/hr.employee                   | Detail view   |
| POST     | /create/hr.employee                 | Create record |
| PUT      | /write/hr.employee                  | Update record |
| POST     | /call/hr.employee/attendance_manual | Check in/out  |

### res.users

| Method   | Path                   | Purpose       |
|:---------|:-----------------------|:--------------|
| GET      | /search_read/res.users | List view     |
| GET      | /read/res.users        | Detail view   |
| POST     | /create/res.users      | Create record |
| PUT      | /write/res.users       | Update record |

### res.company

| Method   | Path                     | Purpose       |
|:---------|:-------------------------|:--------------|
| GET      | /search_read/res.company | List view     |
| GET      | /read/res.company        | Detail view   |
| POST     | /create/res.company      | Create record |
| PUT      | /write/res.company       | Update record |

