import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { UserRole } from '@ozimai/shared';
import { OrganizationsService } from './organizations.service';
import { CreateBranchDto, CreatePractitionerDto, CreateServiceDto, UpdateOrganizationDto } from './dto/organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get('me')
  getMe() {
    return this.service.getMyOrg();
  }

  @Roles(UserRole.Owner, UserRole.Admin)
  @Patch('me')
  updateMe(@Body() dto: UpdateOrganizationDto) {
    return this.service.updateMyOrg(dto);
  }

  @Get('branches')
  listBranches() {
    return this.service.listBranches();
  }

  @Roles(UserRole.Owner, UserRole.Admin)
  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto) {
    return this.service.createBranch(dto);
  }

  @Get('practitioners')
  listPractitioners() {
    return this.service.listPractitioners();
  }

  @Roles(UserRole.Owner, UserRole.Admin)
  @Post('practitioners')
  createPractitioner(@Body() dto: CreatePractitionerDto) {
    return this.service.createPractitioner(dto);
  }

  @Roles(UserRole.Owner, UserRole.Admin)
  @Patch('practitioners/:id/working-hours')
  updateHours(@Param('id') id: string, @Body('workingHours') workingHours: Record<number, [string, string] | null>) {
    return this.service.updatePractitionerHours(id, workingHours);
  }

  @Get('services')
  listServices() {
    return this.service.listServices();
  }

  @Roles(UserRole.Owner, UserRole.Admin)
  @Post('services')
  createService(@Body() dto: CreateServiceDto) {
    return this.service.createService(dto);
  }
}
