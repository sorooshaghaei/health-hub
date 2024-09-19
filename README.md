# Health-Hub Web App

## Introduction
**Health-Hub** is a comprehensive web application designed to manage medical information, track patients, and schedule appointments. It features an intuitive interface for monitoring key healthcare metrics and enhancing coordination among healthcare providers.

## Features
- **Patient Management:** Efficiently manage and view patient records, including medical history and personal details.
- **Appointment Scheduling:** Schedule and manage patient appointments seamlessly.
- **Data Visualization:** Display data trends with charts and graphs, such as patient visits and appointment statistics.
- **Dashboard Overview:** Get a comprehensive view of key metrics like total patients, appointments, and visitors.

## Screenshots
### Web App Views
<img width="445" alt="View Patient Page" src="https://github.com/user-attachments/assets/eef091f1-8d9c-4811-b774-de8b3196322a">
<img width="445" alt="Edit Patient Page" src="https://github.com/user-attachments/assets/24a32215-beb5-410a-8aac-874933923166">
<img width="445" alt="Delete Patient Warning" src="https://github.com/user-attachments/assets/7ddc8abf-883f-4878-9404-5f8ae63db2c5">
<img width="445" alt="Dashboard" src="https://github.com/user-attachments/assets/a9dc8397-616f-4395-b799-f1cba71c57f4">
<img width="445" alt="Add Patient Page" src="https://github.com/user-attachments/assets/e561b6ea-c504-4ea1-820e-8b60def5cd8e">

## Entity-Relationship Diagram (ERD)
### ERD Overview
<img width="445" alt="ERD for System" src="https://github.com/user-attachments/assets/02bbf57a-20d2-4b12-af36-740f99f19d90">

### ERD for Patients Page
<img width="445" alt="ERD for Patients Page" src="https://github.com/user-attachments/assets/927ce789-fc74-400e-a8f8-231dcdce6c9a">

### ERD for Appointment Date
<img width="445" alt="ERD for Appointment Date" src="https://github.com/user-attachments/assets/854c371f-0df0-4980-8f94-ffa42db7c7a8">

## Figma Design
### Design Layouts
<img width="445" alt="Figma Design Patient Info Page" src="https://github.com/user-attachments/assets/73efe7b1-c7a6-4540-961a-658af5cf2732">
<img width="445" alt="Figma Design Dashboard" src="https://github.com/user-attachments/assets/5779a8ea-a86c-4670-afd5-a5b73495d02c">
<img width="445" alt="Figma Design Appointment Page" src="https://github.com/user-attachments/assets/fe4b55b5-77fe-4d1f-8572-9e5277cc6925">

## Project Poster
![Project Poster](https://github.com/sorooshaghaei/health-hub/blob/main/health-hub/src/assets/Health-hub-poster.jpg)

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

    This will start a `json-server` instance, watching `db.json` on port 9000. Access the server at:
    - [http://localhost:9000](http://localhost:9000)
    - Resources:
        - [Patients](http://localhost:9000/patients)
        - [Groups](http://localhost:9000/groups)
        - [Sickness](http://localhost:9000/sickness)
        - [Users](http://localhost:9000/users)

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
