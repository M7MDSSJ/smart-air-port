
## Authentication
All notification endpoints require JWT authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Notification Endpoints

### 1. Get notifications
**GET** `/notification`
**Authentication:** Required (Verified users only)

notifications with state 0 make it with active background and when get them first time they will be old automaticly 
when click on the notification item take the bookingId and get the booking data and go to booking details page

**Response (200):**
```json
{
    "success": true,
    "message": "response.success",
    "data": [
        {
            "topic": "admin or the userId",
            "title": "the title of notification",
            "body": "the body of notification",
            "state": 0 || 1, 0 for new , 1 for old
            "bookingId": "the id of the booking",
        }
    ],
    "error": null,
    "meta": null
}
```

### 2. Get Count of new notifications


**GET** `/notification/count`
**Authentication:** Required (Verified users only)

Get Count of new notifications to put on the icon of notifications badge

**Response (200):**
```json
{
    "success": true,
    "message": "response.success",
    "data": {
        "count": 0
    },
    "error": null,
    "meta": null
}
```



### Subscripe on totification

you need to subscripe on userId coming from login