package com.firealert.resident.model

data class User(
    val id: Int,
    val name: String,
    val email: String,
    val role: String,
    val createdAt: String,
    val updatedAt: String
)

data class AuthResponse(
    val success: Boolean,
    val message: String,
    val data: AuthData?
)

data class AuthData(
    val user: User,
    val accessToken: String,
    val tokenType: String,
    val expiresIn: Int
)