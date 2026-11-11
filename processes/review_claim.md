class ClaimStatus(StrEnum):
    DRAFT = "draft"
    UPLOADING = 'uploading'
    SCANNING = 'scanning'
    PROCESSING = 'processing'
    NEEDS_INFORMATION = 'needs_information'
    PENDING_APPROVAL = 'pending_approval'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    REFUND_SUBMITTED = 'refund_submitted'
    REFUNDED = 'refunded'
    REFUND_FAILED = 'refund_failed'
    PENDING_AI_CAPACITY = 'pending_ai_capacity'
    CLOSED = 'closed'

class DocumentProcessingStatus(StrEnum):
    UPLOADED = 'uploaded'
    MALWARE_SCANNING = 'malware_scanning'
    MALWARE_REJECTED = 'malware_rejected'
    SAFETY_SCANNING = 'safety_scanning'
    SAFETY_REVIEW_REQUIRED = 'safety_review_required'
    SAFETY_BLOCKED = 'safety_blocked'
    READY_FOR_EXTRACTION = 'ready_for_extraction'
    EXTRACTING = 'extracting'
    EXTRACTION_COMPLETE = 'extraction_complete'
    PROCESSING_FAILED = 'processing_failed'


1.2 Customer pick a document processing type (Claim process, leave request, )

1. Customer 

1. Malware scan 

- Clean up after 7 days and soft delete

- Malware scan O

Process document
2. Content Safety

- Rules: 'Hate','Sexual','SelfHarm'

- Status: BLOCK, REVIEW, PASS

3. Content Understanding classification

4. Document Intelligence when structured extraction is needed

5. Evidence-bundle validation

6. Clean evidence promotion

7. Human review