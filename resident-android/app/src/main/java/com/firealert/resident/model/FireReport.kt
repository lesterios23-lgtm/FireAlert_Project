package com.firealert.resident.model

data class FireReport(
    val id: Int,
    val type: String,
    val attributes: FireReportAttributes,
    val relationships: FireReportRelationships?,
    val links: FireReportLinks?
)

data class FireReportAttributes(
    val incidentDescription: String?,
    val incidentAddress: String?,
    val latitude: Double?,
    val longitude: Double?,
    val locationSource: String?,
    val status: String,
    val reportedAt: String?,
    val createdAt: String?,
    val updatedAt: String?
)

data class FireReportRelationships(
    val resident: ResidentRelationship?
)

data class ResidentRelationship(
    val data: ResidentData?
)

data class ResidentData(
    val type: String,
    val id: Int
)

data class FireReportLinks(
    val self: String?
)