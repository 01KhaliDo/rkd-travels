// 🔄 Förhindra cache och tvinga sidan att laddas om varje gång
window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        window.location.reload();
    }
});

// 🟧 Inloggningsfunktion
async function loginUser() {
    localStorage.removeItem('user_id'); // Rensar innan ny data sätts in

    const email = document.getElementById('login_email').value;
    const password = document.getElementById('login_password').value;

    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (result.status === "success") {
        localStorage.setItem('user_id', result.user.user_id);
        window.location.href = "index.html";
    } else {
        alert("Felaktigt användarnamn eller lösenord. Var god försök igen.");
        document.getElementById('login_response').innerText = result.message;
    }
}


function logoutUser() {
    localStorage.removeItem('user_id'); // Tar bort user_id från localStorage
    alert("Du har loggats ut.");
    window.location.href = "index.html"; // Skickar användaren till startsidan
}

document.addEventListener('DOMContentLoaded', function () {
    const logoutLink = document.getElementById('authLink'); // Hämta länken med ID

    if (localStorage.getItem('user_id')) {
        logoutLink.innerText = 'Logga ut';
        logoutLink.setAttribute('onclick', 'logoutUser()');
        logoutLink.href = '#';  // Undvik navigation om onclick används
    } else {
        logoutLink.innerText = 'Logga in';
        logoutLink.setAttribute('onclick', '');
        logoutLink.href = 'login.html'; // Skicka till inloggningssidan
    }
});


// 🟩 Registreringsfunktion
async function registerUser() {
    const firstName = document.getElementById('register_first_name').value;
    const lastName = document.getElementById('register_last_name').value;
    const email = document.getElementById('register_email').value;
    const phone = document.getElementById('register_phone').value;
    const password = document.getElementById('register_password').value;

    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone, 
            password: password
        })
    });

    const result = await response.json();

    if (result.status === "success") {
        alert("Registrering lyckades! Du kan nu logga in.");
    } else {
        document.getElementById('register_response').innerText = result.message;
    }
}


// 🟦 Hämta resor för index.html
async function fetchTrips() {
    const response = await fetch('/api/getTrips');
    const data = await response.json();

    const tripsContainer = document.getElementById('tripsContainer');
    tripsContainer.innerHTML = '';

    if (data.status === "success") {
        // Begränsa till de första 8 resorna med slice()
        data.trips.slice(0, 8).forEach(trip => {
            const template = document.getElementById('tripCardTemplate').content.cloneNode(true);

            template.querySelector('.trip-image').src = trip.image_url;
            template.querySelector('.city-info').innerText = `${trip.destination}`;
            template.querySelector('.trip-content h3').innerText = `${trip.country}`;
            template.querySelector('.hotel-info').innerText = `${trip.description}`;

            tripsContainer.appendChild(template);
        });
    } else {
        tripsContainer.innerHTML = `<p>Inga resor hittades.</p>`;
    }
}





// 🔹 Boka resa
async function bookTrip() {
    const userId = localStorage.getItem('user_id');
    const currentTripId = new URLSearchParams(window.location.search).get('trip_id');

    if (!userId) {
        alert("Du måste vara inloggad för att boka en resa.");
        return;
    }

    const response = await fetch(`/api/bookTrip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: parseInt(userId),
            trip_id: parseInt(currentTripId)
        })
    });

    const result = await response.json();

    if (result.status === "success") {
        alert("Bokningen lyckades!");
        document.getElementById('availableSeats').innerText = result.newSeats;
    } else {
        alert(`Fel vid bokning: ${result.message}`);
    }
} 

async function bookTripFromDetails(tripId) {
    const userId = localStorage.getItem('user_id');
    const travelsNum = parseInt(document.getElementById('travels_num').value);  // Nytt fält för antal resenärer

    if (!userId) {
        alert("Du måste vara inloggad för att boka en resa.");
        return;
    }

    const response = await fetch(`/api/bookTrip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: parseInt(userId),
            trip_id: parseInt(tripId),
            travels_num: travelsNum   // Skickar med antal resenärer
        })
    });

    const result = await response.json();

    if (result.status === "success") {
        alert("Bokningen lyckades!"); 
        location.reload();
    } else {
        alert(`Fel vid bokning: ${result.message}`);
        location.reload();
    }
}



// 🔎 Sök efter resor baserat på destination och antal resenärer
const travelSearchForm = document.getElementById('travelSearchForm');

if (travelSearchForm) {
    travelSearchForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const selectedDestination = document.getElementById('destination').value;
        const selectedTravelers = parseInt(document.getElementById('travelers').value);

        const response = await fetch('/api/getTrips');
        const data = await response.json();

        const searchResultsBody = document.getElementById('searchResultsBody');
        searchResultsBody.innerHTML = '';

        if (data.status === "success") {
            const filteredTrips = data.trips.filter(trip => 
                trip.destination.toLowerCase() === selectedDestination.toLowerCase() &&
                trip.available_seats >= selectedTravelers
            );

            if (filteredTrips.length > 0) {
                filteredTrips.forEach(trip => {
                    const row = document.createElement('tr');

                    row.innerHTML = `
                        <td>${trip.destination}</td>
                        <td>${trip.hotel_name} (${trip.hotel_stars} ⭐)</td>
                        <td>${trip.flight_airline}</td>
                        <td>${trip.price} kr</td>
                        <td>${new Date(trip.departure_time).toLocaleDateString()}</td>
                        <td>${new Date(trip.return_time).toLocaleDateString()}</td>
                        <td>${trip.available_seats}</td>
                        <td>
                            <button class="button" onclick="redirectToBookingPage(${trip.trip_id})">Boka</button>
                        </td>
                    `;

                    searchResultsBody.appendChild(row);
                });
            } else {
                searchResultsBody.innerHTML = `<tr><td colspan="7" >Inga resor hittades.</td></tr>`;
            }
        } else {
            searchResultsBody.innerHTML = `<tr><td colspan="7">Det gick inte att hämta resorna.</td></tr>`;
        }
    });
    
}

// 🟨 Omdirigera till en ny sida vid klick på "Boka"
function redirectToBookingPage(tripId) {
    window.location.href = `booking_details.html?trip_id=${tripId}`;
}


// 🔄 Ladda data automatiskt
window.onload = function () {
    if (document.getElementById('tripsContainer')) {
        fetchTrips();
    }

    if (document.getElementById('tripDetails')) {
        loadTripDetails();
    }
};  



// 🟨 Hämta bokningsdetaljer
async function loadBookingDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const tripId = urlParams.get('trip_id');

    if (!tripId) {
        document.getElementById('tripDetails').innerHTML = `<p>Ingen resa vald.</p>`;
        return;
    }

    const response = await fetch(`/api/getTripDetails?trip_id=${tripId}`);
    const data = await response.json();

    if (data.status === "success") {
        const trip = data.trip;

        document.getElementById('tripImage').src = trip.image_url;
        document.getElementById('tripTitle').innerText = trip.destination;
        document.getElementById('tripDescription').innerText = trip.description;
        document.getElementById('tripPrice').innerText = trip.price;
        document.getElementById('tripDeparture').innerText = new Date(trip.departure_time).toLocaleDateString();
        document.getElementById('tripReturn').innerText = new Date(trip.return_time).toLocaleDateString();
        document.getElementById('availableSeats').innerText = trip.available_seats;
    } else {
        document.getElementById('tripDetails').innerHTML = `<p>Resan kunde inte hittas.</p>`;
    }
}

// 🟩 Lägg till formulär för extra resenärer
function addTravelerForms() {
    const numTravelers = parseInt(document.getElementById('numTravelers').value);
    const travelersDetails = document.getElementById('travelersDetails');

    travelersDetails.innerHTML = '';

    for (let i = 2; i <= numTravelers; i++) {
        const travelerDiv = document.createElement('div');
        travelerDiv.classList.add('traveler-info');
        travelerDiv.innerHTML = `
            <h3>Resenär ${i}</h3>
            <label for="travelerName${i}">Namn:</label>
            <input type="text" id="travelerName${i}" name="travelerName${i}" required>

            <label for="travelerAge${i}">Ålder:</label>
            <input type="number" id="travelerAge${i}" name="travelerAge${i}" required>
        `;

        travelersDetails.appendChild(travelerDiv);
    }
}

// 🟦 Funktion för att hantera bokning
async function submitBooking() {
    const tripId = new URLSearchParams(window.location.search).get('trip_id');
    const userId = localStorage.getItem('user_id');

    if (!userId) {
        alert("Du måste vara inloggad för att boka en resa.");
        return;
    }

    const numTravelers = parseInt(document.getElementById('numTravelers').value);  // ✔️ Viktigt att denna skickas korrekt

    const response = await fetch(`/api/bookTrip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: parseInt(userId),
            trip_id: parseInt(tripId),
            travels_num: numTravelers  // ✔️ Kontrollera att detta skickas korrekt
        })
    });

    const result = await response.json();

    if (result.status === "success") {
        alert("Bokningen lyckades!");
        location.reload();
    } else {
        alert(`Fel vid bokning: ${result.message}`); 
        location.reload();
    }
}


// 🔄 Ladda bokningsdetaljer automatiskt vid sidladdning
window.addEventListener('DOMContentLoaded', loadBookingDetails);







