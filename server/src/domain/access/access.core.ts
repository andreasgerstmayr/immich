import { BadRequestException } from '@nestjs/common';
import { AuthUserDto } from '../auth';
import { IAccessRepository } from './access.repository';

export enum Permission {
  // ASSET_CREATE = 'asset.create',
  ASSET_READ = 'asset.read',
  ASSET_UPDATE = 'asset.update',
  ASSET_DELETE = 'asset.delete',
  ASSET_SHARE = 'asset.share',
  ASSET_VIEW = 'asset.view',
  ASSET_DOWNLOAD = 'asset.download',

  // ALBUM_CREATE = 'album.create',
  // ALBUM_READ = 'album.read',
  ALBUM_UPDATE = 'album.update',
  ALBUM_DELETE = 'album.delete',
  ALBUM_SHARE = 'album.share',

  LIBRARY_READ = 'library.read',
  LIBRARY_DOWNLOAD = 'library.download',
}

export class AccessCore {
  constructor(private repository: IAccessRepository) {}

  async requirePermission(authUser: AuthUserDto, permission: Permission, ids: string[] | string) {
    const hasAccess = await this.hasPermission(authUser, permission, ids);
    if (!hasAccess) {
      throw new BadRequestException(`Not found or no ${permission} access`);
    }
  }

  async hasPermission(authUser: AuthUserDto, permission: Permission, ids: string[] | string) {
    ids = Array.isArray(ids) ? ids : [ids];

    const isSharedLink = authUser.isPublicUser ?? false;

    for (const id of ids) {
      const hasAccess = isSharedLink
        ? await this.hasSharedLinkAccess(authUser, permission, id)
        : await this.hasOtherAccess(authUser, permission, id);
      if (!hasAccess) {
        return false;
      }
    }

    return true;
  }

  private async hasSharedLinkAccess(authUser: AuthUserDto, permission: Permission, id: string) {
    const sharedLinkId = authUser.sharedLinkId;
    if (!sharedLinkId) {
      return false;
    }

    switch (permission) {
      case Permission.ASSET_READ:
        return this.repository.asset.hasSharedLinkAccess(sharedLinkId, id);

      case Permission.ASSET_VIEW:
        return await this.repository.asset.hasSharedLinkAccess(sharedLinkId, id);

      case Permission.ASSET_DOWNLOAD:
        return !!authUser.isAllowDownload && (await this.repository.asset.hasSharedLinkAccess(sharedLinkId, id));

      case Permission.ASSET_SHARE:
        // TODO: fix this to not use authUser.id for shared link access control
        return this.repository.asset.hasOwnerAccess(authUser.id, id);

      // case Permission.ALBUM_READ:
      //   return this.repository.album.hasSharedLinkAccess(sharedLinkId, id);

      default:
        return false;
    }
  }

  private async hasOtherAccess(authUser: AuthUserDto, permission: Permission, id: string) {
    switch (permission) {
      case Permission.ASSET_READ:
        return (
          (await this.repository.asset.hasOwnerAccess(authUser.id, id)) ||
          (await this.repository.asset.hasAlbumAccess(authUser.id, id)) ||
          (await this.repository.asset.hasPartnerAccess(authUser.id, id))
        );
      case Permission.ASSET_UPDATE:
        return this.repository.asset.hasOwnerAccess(authUser.id, id);

      case Permission.ASSET_DELETE:
        return this.repository.asset.hasOwnerAccess(authUser.id, id);

      case Permission.ASSET_SHARE:
        return (
          (await this.repository.asset.hasOwnerAccess(authUser.id, id)) ||
          (await this.repository.asset.hasPartnerAccess(authUser.id, id))
        );

      case Permission.ASSET_VIEW:
        return (
          (await this.repository.asset.hasOwnerAccess(authUser.id, id)) ||
          (await this.repository.asset.hasAlbumAccess(authUser.id, id)) ||
          (await this.repository.asset.hasPartnerAccess(authUser.id, id))
        );

      case Permission.ASSET_DOWNLOAD:
        return (
          (await this.repository.asset.hasOwnerAccess(authUser.id, id)) ||
          (await this.repository.asset.hasAlbumAccess(authUser.id, id)) ||
          (await this.repository.asset.hasPartnerAccess(authUser.id, id))
        );

      // case Permission.ALBUM_READ:
      //   return this.repository.album.hasOwnerAccess(authUser.id, id);

      case Permission.ALBUM_UPDATE:
        return this.repository.album.hasOwnerAccess(authUser.id, id);

      case Permission.ALBUM_DELETE:
        return this.repository.album.hasOwnerAccess(authUser.id, id);

      case Permission.ALBUM_SHARE:
        return this.repository.album.hasOwnerAccess(authUser.id, id);

      case Permission.LIBRARY_READ:
        return authUser.id === id || (await this.repository.library.hasPartnerAccess(authUser.id, id));

      case Permission.LIBRARY_DOWNLOAD:
        return authUser.id === id;
    }

    return false;
  }
}