import "reflect-metadata";

const TARGET_MANAGED_TRANSACTION = Symbol("TARGET_MANAGED_TRANSACTION");

export const ManagedTransaction: ClassDecorator = (target) => {
  // 트랜잭션 관리 대상의 키 이름
  // 해당 부분은 런타임 체크라 타입 안전성 검사가 불가능하니
  // 반드시 이 기능을 사용할 때는 타입에 주의해서 사용할 것.
  const usingManagedTransaction = Reflect.getMetadata(
    TARGET_MANAGED_TRANSACTION,
    target.prototype
  );
  if (usingManagedTransaction === undefined) {
    console.error(
      "ManagedTransaction이 호출되었음에도 UsingManagedTransaction으로 저장된 필드가 없습니다."
    );
    return;
  }
  // 클래스 정의로부터 메서드들을 불러 옴
  for (const ownKey of Reflect.ownKeys(target.prototype)) {
    // 프로퍼티 기술자를 가져옴
    // 아마 반드시 존재할 것이므로 확인없이 undefined 제거
    const ownDesc = Reflect.getOwnPropertyDescriptor(
      target.prototype,
      ownKey
    ) as PropertyDescriptor;
    // 만약 해당 필드가 함수에 ownKey === ownDesc.value.name인 경우에만 관리 모드 적용
    // 함수가 아닌경우 관리의 필요가 없고(그럴 일은 없지만)
    // 만약 이름이 다른 경우는 생성자일 때 밖에 없을 것임(별도의 외부 라이브러리가 손대지 않는 이상)
    if (
      typeof ownDesc?.value === "function" &&
      ownDesc?.value?.name === ownKey
    ) {
      // =========================================================== //
      // 1단계 : 원본 메서드의 메타데이터를 복사함
      const metasForInner = Reflect.getMetadataKeys(ownDesc.value).map((v) => [
        v,
        Reflect.getMetadata(v, ownDesc.value),
      ]);
      // =========================================================== //
      // 2단계 : 원본 메서드를 감싸 줄 래핑 함수를 새로 만듬
      // 실제 트랜잭션을 감싸 줄 래핑 함수를 정의함
      const inner = async function (...args: any[]) {
        // 원리는 간단, 원본 this를 얕은 복사해 nthis를 생성
        // 대상이 되는 필드의 값을 transaction 호출로 트랜잭션으로 묶은 뒤 이 값을 원본 this의 EntityManager와 대체
        // 이후 원본 함수를 이 nthis를 주입해서 호출함
        // 아래 기능들은 type safe 하지 않은 코드들이라 컴파일러 침묵이 불가피
        // @ts-ignore
        const nthis = Object.create(this);
        // @ts-ignore
        return await this.em.transaction(async (transem) => {
          Reflect.defineProperty(nthis, usingManagedTransaction, {
            value: transem,
          });
          const result = await ownDesc?.value.call(nthis, ...args);
          return result;
        });
      };
      // inner 함수의 디스크립터 수정
      // 이 값을 설정함으로서 원본 메서드를 완전히 대체할 수 있는 함수를 생성 가능함
      Reflect.defineProperty(inner, "name", {
        configurable: true,
        enumerable: false,
        value: ownDesc?.value?.name,
        writable: false,
      });
      Reflect.defineProperty(inner, "length", {
        configurable: true,
        enumerable: false,
        value: ownDesc?.value?.name,
        writable: false,
      });
      // inner 함수의 메타데이터 재정의
      for (const [metak, metav] of metasForInner) {
        Reflect.defineMetadata(metak, metav, inner);
      }
      // =========================================================== //
      // 3단계 : 클래스에서 메서드를 내가 만든 inner로 주입함
      Reflect.defineProperty(target.prototype, ownKey, {
        configurable: ownDesc?.configurable,
        enumerable: ownDesc?.enumerable,
        value: inner,
        writable: ownDesc?.writable,
      });
      // =========================================================== //
    }
  }
};

export const UsingManagedTransaction: PropertyDecorator = (target, key) => {
  //자기 자신의 필드명을 메타데이터의 값으로 저장.
  Reflect.defineMetadata(TARGET_MANAGED_TRANSACTION, key, target);
};
