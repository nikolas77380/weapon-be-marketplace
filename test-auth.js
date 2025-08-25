const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const API_BASE = "http://localhost:1337";

async function testJWTToken(jwt) {
  console.log("Testing JWT token...\n");

  try {
    const response = await fetch(`${API_BASE}/api/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    console.log("JWT test response status:", response.status);
    console.log("JWT test response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error during JWT test:", error);
  }
}

async function testWrongPassword() {
  console.log("Testing login with wrong password...\n");

  try {
    // Try to login with wrong password
    console.log("Attempting login with wrong password...");
    const loginResponse = await fetch(`${API_BASE}/api/auth/local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: "testseller11@example.com",
        password: "wrongpassword",
      }),
    });

    const loginData = await loginResponse.json();
    console.log("Login response status:", loginResponse.status);
    console.log("Login response:", JSON.stringify(loginData, null, 2));
  } catch (error) {
    console.error("Error during login test:", error);
  }
}

async function testExistingSellerLogin() {
  console.log("Testing login with existing seller...\n");

  try {
    // Try to login with existing seller
    console.log("Attempting login with existing seller...");
    const loginResponse = await fetch(`${API_BASE}/api/auth/local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: "testseller13@example.com",
        password: "testpassword123",
      }),
    });

    const loginData = await loginResponse.json();
    console.log("Login response status:", loginResponse.status);
    console.log("Login response:", JSON.stringify(loginData, null, 2));

    if (loginResponse.ok && loginData.jwt) {
      console.log("✅ Login successful with existing seller");
      console.log("User role:", loginData.user?.role?.name);
    } else {
      console.log("❌ Login failed with existing seller");
    }
  } catch (error) {
    console.error("Error during login test:", error);
  }
}

async function testSellerAuth() {
  console.log("Testing seller registration and login...\n");

  // Test data
  const testSeller = {
    username: "testseller13",
    email: "testseller13@example.com",
    password: "testpassword123",
    displayName: "Test Seller 13",
    provider: "local",
    role: "seller",
  };

  try {
    // Step 1: Register seller
    console.log("1. Registering seller...");
    const registerResponse = await fetch(
      `${API_BASE}/api/auth/local/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testSeller),
      }
    );

    const registerData = await registerResponse.json();
    console.log("Register response status:", registerResponse.status);
    console.log("Register response:", JSON.stringify(registerData, null, 2));

    if (registerResponse.ok && registerData.jwt) {
      console.log("✅ Seller registered successfully");

      // Test JWT token
      await testJWTToken(registerData.jwt);

      // Step 2: Try to login with the same credentials
      console.log("\n2. Testing login...");
      const loginResponse = await fetch(`${API_BASE}/api/auth/local`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: testSeller.email,
          password: testSeller.password,
        }),
      });

      const loginData = await loginResponse.json();
      console.log("Login response status:", loginResponse.status);
      console.log("Login response:", JSON.stringify(loginData, null, 2));

      if (loginResponse.ok && loginData.jwt) {
        console.log("✅ Login successful");
        console.log("User role:", loginData.user?.role?.name);
      } else {
        console.log("❌ Login failed");
      }
    } else {
      console.log("❌ Seller registration failed");
    }
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the tests
async function runTests() {
  await testWrongPassword();
  console.log("\n" + "=".repeat(50) + "\n");
  await testExistingSellerLogin();
  console.log("\n" + "=".repeat(50) + "\n");
  await testSellerAuth();
}

runTests();
