# Health-Hub Web App

## Introduction
**Health-Hub** is a comprehensive web application designed for managing medical information, tracking patients, and scheduling appointments. This system provides an intuitive interface for monitoring key healthcare metrics and improving coordination among healthcare providers.

## Features
- **Patient Management:** Manage and view patient records, including medical history and personal details.
- **Appointment Scheduling:** Schedule and manage patient appointments efficiently.
- **Data Visualization:** Visualize data trends with charts and graphs, such as patient visits and appointment statistics.
- **Dashboard Overview:** Get an overview of key metrics like total patients, appointments, and visitors.

## Screenshots

### Dashboard
![Dashboard](https://github.com/sorooshaghaei/health-hub/assets/dashboard-screenshot.png)

### Patient Management
![Patient Management](https://github.com/sorooshaghaei/health-hub/assets/patient-management-screenshot.png)

### Appointment Scheduling
![Appointment Scheduling](https://github.com/sorooshaghaei/health-hub/assets/appointment-scheduling-screenshot.png)

## Project Poster
![Project Poster](https://github.com/sorooshaghaei/health-hub/src/assets/Health-hub-poster.jpg)


## Installation

1. **Clone the Repository:**
    ```bash
    git clone https://github.com/sorooshaghaei/health-hub.git
    ```

2. **Navigate to the Project Directory:**
    ```bash
    cd health-hub
    ```

3. **Install Dependencies:**
    ```bash
    npm install
    ```

4. **Setup Environment Variables:**
    Create a `.env` file in the root directory and add the necessary environment variables. Example:
    ```bash
    PORT=9000
    ```

## Running the Server

1. **Navigate to the Server Directory:**
    ```bash
    cd server
    ```

2. **Start the Development Server:**
    ```bash
    npm start
    ```

    This command will start a `json-server` instance, watching `db.json` on port 9000. You can access the server at:
    - [http://localhost:9000](http://localhost:9000)
    - Resources:
        - [http://localhost:9000/patients](http://localhost:9000/patients)
        - [http://localhost:9000/groups](http://localhost:9000/groups)
        - [http://localhost:9000/sickness](http://localhost:9000/sickness)
        - [http://localhost:9000/users](http://localhost:9000/users)

## Usage

1. **Open the Application:** Access the application in your browser at [http://localhost:9000](http://localhost:9000).
2. **Dashboard:** View overall statistics and data trends on the dashboard.
3. **Patient Management:** Manage patient records and view detailed information.
4. **Appointment Scheduling:** Schedule new appointments and manage existing ones.

## Requirements

- **Node.js:** Version 14 or higher.
- **npm:** Node Package Manager.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributions
Contributions, issues, and feature requests are welcome! Please check the [issues page](https://github.com/sorooshaghaei/health-hub/issues) for more details.
