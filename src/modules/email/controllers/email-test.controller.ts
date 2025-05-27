import { Controller, Get, Query } from '@nestjs/common';
import { EmailTemplateService } from '../services/email-template.service';

@Controller('email-test')
export class EmailTestController {
  constructor(private emailTemplateService: EmailTemplateService) {}

  @Get('qr-code')
  async testQRCode(@Query('bookingRef') bookingRef: string = 'TEST123') {
    const result = await this.emailTemplateService.testQRCodeGeneration(bookingRef);
    
    return {
      success: true,
      message: 'QR code test completed',
      data: result,
    };
  }

  @Get('email-preview')
  async previewEmail(@Query('bookingRef') bookingRef: string = 'TEST123') {
    const testBookingData = {
      bookingRef: bookingRef,
      flightId: 'FL123456',
      originAirportCode: 'LGA',
      destinationAirportCode: 'DAD',
      originCity: 'New York',
      destinationCity: 'Da Nang',
      departureDate: new Date('2024-08-28T14:00:00Z'),
      arrivalDate: new Date('2024-08-28T18:00:00Z'),
      totalPrice: 900.00,
      currency: 'USD',
      travellersInfo: [
        {
          firstName: 'Ahmed',
          lastName: 'Mohamed',
          travelerType: 'adult',
        },
        {
          firstName: 'Sara',
          lastName: 'Ahmed',
          travelerType: 'adult',
        },
      ],
      contactDetails: {
        email: 'test@example.com',
        phone: '+201234567890',
      },
      selectedBaggageOption: {
        type: 'checked',
        weight: '23kg',
        price: 50,
        currency: 'USD',
      },
    };

    try {
      const html = await this.emailTemplateService.generateBookingConfirmationEmail(testBookingData);
      
      return {
        success: true,
        message: 'Email preview generated',
        data: {
          html: html,
          bookingRef: bookingRef,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to generate email preview',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
