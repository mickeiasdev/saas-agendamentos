# Modelo de dados — Cloud Firestore

## Estrutura multi-tenant

Todas as entidades do negócio ficam **dentro** do documento do tenant, como subcoleções:

```
tenants/{tenantId}                         # dados públicos + branding + plano
├── users/{userId}?                        # (opcional) equipe do tenant
├── categories/{categoryId}
├── services/{serviceId}
├── professionals/{professionalId}
├── availability/{availabilityId}          # 1 por profissional
├── holidays/{holidayId}
├── customers/{customerId}
├── appointments/{appointmentId}
├── payments/{paymentId}
├── coupons/{couponId}
├── reviews/{reviewId}
├── notifications/{notificationId}
└── audit/{auditLogId}

# Coleções globais
users/{uid}                               # perfis + papel na plataforma
tenant_users/{userId_tenantId}            # vínculo usuário ↔ tenant + role
plans/{planId}                            # catálogo de planos
```

## Entidades principais

### Tenant
`name`, `tradeName`, `cnpjCpf`, `phone`, `whatsapp`, `email`, `address`,
`instagram`, `description`, `logoUrl`, `segmentId`, `slug`,
`planId`, `status`, `subscriptionStatus`, `ownerUserId`,
`settings` (timezone, currency, slotIntervalMinutes, bookingLeadTimeMinutes...),
`branding` (primaryColor, theme, galleryUrls, testimonials, faq, socialLinks...),
`featureFlags` (payments, whatsapp, customDomain, reports, loyalty, inventory, multiBranch, api),
`limits` (maxProfessionals, maxCustomers, maxAppointmentsPerMonth, maxStorageGb, maxBranches).

### Service
`name`, `description`, `price`, `durationMinutes`, `categoryId`, `imageUrl`,
`status`, `commissionPercent`, `requiresProfessional`, `professionals[]`.

### Professional
`name`, `photoUrl`, `description`, `phone`, `email`, `color`, `active`, `serviceIds[]`.

### Availability (por profissional)
`workDays[]` (dayOfWeek, enabled, startTime, endTime, breaks[]),
`daysOff[]`, `vacations[]` (startDate, endDate), `blockedDates[]`, `exceptions[]`.

### Appointment
`professionalId`, `serviceId`, `customerId`, `startAt`, `endAt`, `status`,
`paymentStatus`, `price`, `notes`, `createdBy`, `cancelWindowDeadline`.

### Customer
`name`, `email`, `phone`, `whatsapp`, `birthDate`, `notes`, `tags[]`,
`totalSpent`, `visitCount`, `lastVisitAt`.

## Convenções

- **Timestamps**: campos `createdAt`/`updatedAt` usam `serverTimestamp()`.
- **IDs**: gerados pelo Firestore (`addDoc` / `doc().id`).
- **Slots**: representados por `startAt`/`endAt` no documento do agendamento
  (não existem documentos de "slot" — o horário livre é derivado do expediente
  menos os agendamentos, o que evita corrida e documentos desnecessários).
- **Paginação**: listas grandes (clientes, agendamentos, logs) usam `startAfter` + `limit`.

## Índices

Definidos em `firestore.indexes.json`. Necessários para:
- `tenant_users`: filtro por `userId`
- `availability`: filtro por `professionalId`
- `appointments`: combinações `professionalId + startAt`, `startAt + status`

Ao adicionar novas queries compostas, o Firebase solicita o índice — aplique-o
no console ou via `firebase deploy --only firestore:indexes`.
