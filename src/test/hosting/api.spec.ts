import { expect } from "chai";
import * as nock from "nock";

import { identityOrigin, hostingApiOrigin } from "../../api";
import { FirebaseError } from "../../error";
import * as hostingApi from "../../hosting/api";

const TEST_CHANNELS_RESPONSE = {
  channels: [
    // domain exists in TEST_GET_DOMAINS_RESPONSE
    { url: "https://my-site--ch1-4iyrl1uo.web.app" },
    // domain does not exist in TEST_GET_DOMAINS_RESPONSE
    // we assume this domain was manually removed by
    // the user from the identity api
    { url: "https://my-site--ch2-ygd8582v.web.app" },
  ],
};
const TEST_GET_DOMAINS_RESPONSE = {
  authorizedDomains: [
    "my-site.firebaseapp.com",
    "localhost",
    "randomurl.com",
    "my-site--ch1-4iyrl1uo.web.app",
    // domain that should be removed
    "my-site--expiredchannel-difhyc76.web.app",
  ],
};

const EXPECTED_DOMAINS_RESPONSE = [
  "my-site.firebaseapp.com",
  "localhost",
  "randomurl.com",
  "my-site--ch1-4iyrl1uo.web.app",
];
const PROJECT_ID = "test-project";
const SITE = "my-site";

describe("hosting", () => {
  describe("getChannel", () => {
    afterEach(nock.cleanAll);

    it("should make the API request for a channel", async () => {
      const CHANNEL_ID = "my-channel";
      const CHANNEL = { name: "my-channel" };
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels/${CHANNEL_ID}`)
        .reply(200, CHANNEL);

      const res = await hostingApi.getChannel(PROJECT_ID, SITE, CHANNEL_ID);

      expect(res).to.deep.equal({ name: "my-channel" });
      expect(nock.isDone()).to.be.true;
    });

    it("should return null if there's no channel", async () => {
      const CHANNEL_ID = "my-channel";
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels/${CHANNEL_ID}`)
        .reply(404, {});

      const res = await hostingApi.getChannel(PROJECT_ID, SITE, CHANNEL_ID);

      expect(res).to.deep.equal(null);
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      const CHANNEL_ID = "my-channel";
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels/${CHANNEL_ID}`)
        .reply(500, { error: "server boo-boo" });

      await expect(
        hostingApi.getChannel(PROJECT_ID, SITE, CHANNEL_ID)
      ).to.eventually.be.rejectedWith(FirebaseError, /server boo-boo/);

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("listChannels", () => {
    afterEach(nock.cleanAll);

    it("should make a single API requests to list a small number of channels", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`)
        .query({ pageToken: "", pageSize: 10 })
        .reply(200, { channels: [{ name: "channel01" }] });

      const res = await hostingApi.listChannels(PROJECT_ID, SITE);

      expect(res).to.deep.equal([{ name: "channel01" }]);
      expect(nock.isDone()).to.be.true;
    });

    it("should make multiple API requests to list channels", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`)
        .query({ pageToken: "", pageSize: 10 })
        .reply(200, { channels: [{ name: "channel01" }], nextPageToken: "02" });
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`)
        .query({ pageToken: "02", pageSize: 10 })
        .reply(200, { channels: [{ name: "channel02" }] });

      const res = await hostingApi.listChannels(PROJECT_ID, SITE);

      expect(res).to.deep.equal([{ name: "channel01" }, { name: "channel02" }]);
      expect(nock.isDone()).to.be.true;
    });

    it("should return an error if there's no channel", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`)
        .query({ pageToken: "", pageSize: 10 })
        .reply(404, {});

      await expect(hostingApi.listChannels(PROJECT_ID, SITE)).to.eventually.be.rejectedWith(
        FirebaseError,
        /could not find channels/
      );

      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`)
        .query({ pageToken: "", pageSize: 10 })
        .reply(500, { error: "server boo-boo" });

      await expect(hostingApi.listChannels(PROJECT_ID, SITE)).to.eventually.be.rejectedWith(
        FirebaseError,
        /server boo-boo/
      );

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("createChannel", () => {
    afterEach(nock.cleanAll);

    it("should make the API request to create a channel", async () => {
      const CHANNEL_ID = "my-channel";
      const CHANNEL = { name: "my-channel" };
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`, { ttl: "604800s" })
        .query({ channelId: CHANNEL_ID })
        .reply(201, CHANNEL);

      const res = await hostingApi.createChannel(PROJECT_ID, SITE, CHANNEL_ID);

      expect(res).to.deep.equal(CHANNEL);
      expect(nock.isDone()).to.be.true;
    });

    it("should let us customize the TTL", async () => {
      const CHANNEL_ID = "my-channel";
      const CHANNEL = { name: "my-channel" };
      const TTL = "60s";
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`, { ttl: TTL })
        .query({ channelId: CHANNEL_ID })
        .reply(201, CHANNEL);

      const res = await hostingApi.createChannel(PROJECT_ID, SITE, CHANNEL_ID, 60_000);

      expect(res).to.deep.equal(CHANNEL);
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      const CHANNEL_ID = "my-channel";
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`, { ttl: "604800s" })
        .query({ channelId: CHANNEL_ID })
        .reply(500, { error: "server boo-boo" });

      await expect(
        hostingApi.createChannel(PROJECT_ID, SITE, CHANNEL_ID)
      ).to.eventually.be.rejectedWith(FirebaseError, /server boo-boo/);

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("updateChannelTtl", () => {
    afterEach(nock.cleanAll);

    it("should make the API request to update a channel", async () => {
      const CHANNEL_ID = "my-channel";
      const CHANNEL = { name: "my-channel" };
      nock(hostingApiOrigin)
        .patch(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels/${CHANNEL_ID}`, {
          ttl: "604800s",
        })
        .query({ updateMask: "ttl" })
        .reply(201, CHANNEL);

      const res = await hostingApi.updateChannelTtl(PROJECT_ID, SITE, CHANNEL_ID);

      expect(res).to.deep.equal(CHANNEL);
      expect(nock.isDone()).to.be.true;
    });

    it("should let us customize the TTL", async () => {
      const CHANNEL_ID = "my-channel";
      const CHANNEL = { name: "my-channel" };
      const TTL = "60s";
      nock(hostingApiOrigin)
        .patch(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels/${CHANNEL_ID}`, { ttl: TTL })
        .query({ updateMask: "ttl" })
        .reply(201, CHANNEL);

      const res = await hostingApi.updateChannelTtl(PROJECT_ID, SITE, CHANNEL_ID, 60_000);

      expect(res).to.deep.equal(CHANNEL);
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      const CHANNEL_ID = "my-channel";
      nock(hostingApiOrigin)
        .patch(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels/${CHANNEL_ID}`, {
          ttl: "604800s",
        })
        .query({ updateMask: "ttl" })
        .reply(500, { error: "server boo-boo" });

      await expect(
        hostingApi.updateChannelTtl(PROJECT_ID, SITE, CHANNEL_ID)
      ).to.eventually.be.rejectedWith(FirebaseError, /server boo-boo/);

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("deleteChannel", () => {
    afterEach(nock.cleanAll);

    it("should make the API request to delete a channel", async () => {
      const CHANNEL_ID = "my-channel";
      const CHANNEL = { name: "my-channel" };
      nock(hostingApiOrigin)
        .delete(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels/${CHANNEL_ID}`)
        .reply(204, CHANNEL);

      const res = await hostingApi.deleteChannel(PROJECT_ID, SITE, CHANNEL_ID);

      expect(res).to.be.undefined;
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      const CHANNEL_ID = "my-channel";
      nock(hostingApiOrigin)
        .delete(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels/${CHANNEL_ID}`)
        .reply(500, { error: "server boo-boo" });

      await expect(
        hostingApi.deleteChannel(PROJECT_ID, SITE, CHANNEL_ID)
      ).to.eventually.be.rejectedWith(FirebaseError, /server boo-boo/);

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("cloneVersion", () => {
    afterEach(nock.cleanAll);

    it("should make the API requests to clone a version", async () => {
      const SOURCE_VERSION = "my-version";
      const VERSION = { name: "my-new-version" };
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/-/sites/${SITE}/versions:clone`, {
          sourceVersion: SOURCE_VERSION,
          finalize: false,
        })
        .reply(200, { name: `projects/${PROJECT_ID}/operations/op` });
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/operations/op`)
        .reply(200, {
          name: `projects/${PROJECT_ID}/operations/op`,
          done: true,
          response: VERSION,
        });

      const res = await hostingApi.cloneVersion(SITE, SOURCE_VERSION);

      expect(res).to.deep.equal(VERSION);
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      const SOURCE_VERSION = "my-version";
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/-/sites/${SITE}/versions:clone`, {
          sourceVersion: SOURCE_VERSION,
          finalize: false,
        })
        .reply(500, { error: "server boo-boo" });

      await expect(hostingApi.cloneVersion(SITE, SOURCE_VERSION)).to.eventually.be.rejectedWith(
        FirebaseError,
        /server boo-boo/
      );

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("createRelease", () => {
    afterEach(nock.cleanAll);

    it("should make the API request to create a release", async () => {
      const CHANNEL_ID = "my-channel";
      const RELEASE = { name: "my-new-release" };
      const VERSION_NAME = "versions/me";
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/-/sites/${SITE}/channels/${CHANNEL_ID}/releases`)
        .query({ versionName: VERSION_NAME })
        .reply(201, RELEASE);

      const res = await hostingApi.createRelease(SITE, CHANNEL_ID, VERSION_NAME);

      expect(res).to.deep.equal(RELEASE);
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      const CHANNEL_ID = "my-channel";
      const VERSION_NAME = "versions/me";
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/-/sites/${SITE}/channels/${CHANNEL_ID}/releases`)
        .query({ versionName: VERSION_NAME })
        .reply(500, { error: "server boo-boo" });

      await expect(
        hostingApi.createRelease(SITE, CHANNEL_ID, VERSION_NAME)
      ).to.eventually.be.rejectedWith(FirebaseError, /server boo-boo/);

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("getSite", () => {
    afterEach(nock.cleanAll);

    it("should make the API request for a channel", async () => {
      const SITE_BODY = { name: "my-site" };
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}`)
        .reply(200, SITE_BODY);

      const res = await hostingApi.getSite(PROJECT_ID, SITE);

      expect(res).to.deep.equal(SITE_BODY);
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the site doesn't exist", async () => {
      nock(hostingApiOrigin).get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}`).reply(404, {});

      await expect(hostingApi.getSite(PROJECT_ID, SITE)).to.eventually.be.rejectedWith(
        FirebaseError,
        /could not find site/
      );

      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}`)
        .reply(500, { error: "server boo-boo" });

      await expect(hostingApi.getSite(PROJECT_ID, SITE)).to.eventually.be.rejectedWith(
        FirebaseError,
        /server boo-boo/
      );

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("listSites", () => {
    afterEach(nock.cleanAll);

    it("should make a single API requests to list a small number of sites", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites`)
        .query({ pageToken: "", pageSize: 10 })
        .reply(200, { sites: [{ name: "site01" }] });

      const res = await hostingApi.listSites(PROJECT_ID);

      expect(res).to.deep.equal([{ name: "site01" }]);
      expect(nock.isDone()).to.be.true;
    });

    it("should make multiple API requests to list sites", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites`)
        .query({ pageToken: "", pageSize: 10 })
        .reply(200, { sites: [{ name: "site01" }], nextPageToken: "02" });
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites`)
        .query({ pageToken: "02", pageSize: 10 })
        .reply(200, { sites: [{ name: "site02" }] });

      const res = await hostingApi.listSites(PROJECT_ID);

      expect(res).to.deep.equal([{ name: "site01" }, { name: "site02" }]);
      expect(nock.isDone()).to.be.true;
    });

    it("should return an error if there's no site", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites`)
        .query({ pageToken: "", pageSize: 10 })
        .reply(404, {});

      await expect(hostingApi.listSites(PROJECT_ID)).to.eventually.be.rejectedWith(
        FirebaseError,
        /could not find sites/
      );

      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites`)
        .query({ pageToken: "", pageSize: 10 })
        .reply(500, { error: "server boo-boo" });

      await expect(hostingApi.listSites(PROJECT_ID)).to.eventually.be.rejectedWith(
        FirebaseError,
        /server boo-boo/
      );

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("createSite", () => {
    afterEach(nock.cleanAll);

    it("should make the API request to create a channel", async () => {
      const SITE_BODY = { name: "my-new-site" };
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/${PROJECT_ID}/sites`, { appId: "" })
        .query({ siteId: SITE })
        .reply(201, SITE_BODY);

      const res = await hostingApi.createSite(PROJECT_ID, SITE);

      expect(res).to.deep.equal(SITE_BODY);
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      nock(hostingApiOrigin)
        .post(`/v1beta1/projects/${PROJECT_ID}/sites`, { appId: "" })
        .query({ siteId: SITE })
        .reply(500, { error: "server boo-boo" });

      await expect(hostingApi.createSite(PROJECT_ID, SITE)).to.eventually.be.rejectedWith(
        FirebaseError,
        /server boo-boo/
      );

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("updateSite", () => {
    const SITE_OBJ: hostingApi.Site = {
      name: "my-site",
      defaultUrl: "",
      appId: "foo",
      labels: {},
    };

    afterEach(nock.cleanAll);

    it("should make the API request to update a site", async () => {
      nock(hostingApiOrigin)
        .patch(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}`)
        .query({ updateMask: "appId" })
        .reply(201, SITE_OBJ);

      const res = await hostingApi.updateSite(PROJECT_ID, SITE_OBJ, ["appId"]);

      expect(res).to.deep.equal(SITE_OBJ);
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      nock(hostingApiOrigin)
        .patch(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}`)
        .query({ updateMask: "appId" })
        .reply(500, { error: "server boo-boo" });

      await expect(
        hostingApi.updateSite(PROJECT_ID, SITE_OBJ, ["appId"])
      ).to.eventually.be.rejectedWith(FirebaseError, /server boo-boo/);

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("deleteSite", () => {
    afterEach(nock.cleanAll);

    it("should make the API request to delete a site", async () => {
      nock(hostingApiOrigin).delete(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}`).reply(201, {});

      const res = await hostingApi.deleteSite(PROJECT_ID, SITE);

      expect(res).to.be.undefined;
      expect(nock.isDone()).to.be.true;
    });

    it("should throw an error if the server returns an error", async () => {
      nock(hostingApiOrigin)
        .delete(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}`)
        .reply(500, { error: "server boo-boo" });

      await expect(hostingApi.deleteSite(PROJECT_ID, SITE)).to.eventually.be.rejectedWith(
        FirebaseError,
        /server boo-boo/
      );

      expect(nock.isDone()).to.be.true;
    });
  });

  describe("getCleanDomains", () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it("should return the list of expected auth domains after syncing", async () => {
      // mock listChannels response
      nock(hostingApiOrigin)
        .get(`/v1beta1/projects/${PROJECT_ID}/sites/${SITE}/channels`)
        .query(() => true)
        .reply(200, TEST_CHANNELS_RESPONSE);
      // mock getAuthDomains response
      nock(identityOrigin)
        .get(`/admin/v2/projects/${PROJECT_ID}/config`)
        .reply(200, TEST_GET_DOMAINS_RESPONSE);

      const res = await hostingApi.getCleanDomains(PROJECT_ID, SITE);

      expect(res).to.deep.equal(EXPECTED_DOMAINS_RESPONSE);
      expect(nock.isDone()).to.be.true;
    });
  });
});

describe("normalizeName", () => {
  const tests = [
    { in: "happy-path", out: "happy-path" },
    { in: "feature/branch", out: "feature-branch" },
    { in: "featuRe/Branch", out: "featuRe-Branch" },
    { in: "what/are:you_thinking", out: "what-are-you-thinking" },
    { in: "happyBranch", out: "happyBranch" },
    { in: "happy:branch", out: "happy-branch" },
    { in: "happy_branch", out: "happy-branch" },
    { in: "happy#branch", out: "happy-branch" },
  ];

  for (const t of tests) {
    it(`should handle the normalization of ${t.in}`, () => {
      expect(hostingApi.normalizeName(t.in)).to.equal(t.out);
    });
  }
});
